/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { chmod, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FailureCode, GitCode, GitStatus } from "@noldova/git.protocol";

import { CommitConflictsException } from "../../src/exceptions/commit-conflicts.exception.ts";
import { CommitHookFailedException } from "../../src/exceptions/commit-hook-failed.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { NothingStagedException } from "../../src/exceptions/nothing-staged.exception.ts";
import { RequestTooLargeException } from "../../src/exceptions/request-too-large.exception.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { CommitWriter } from "../../src/services/commit.writer.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("CommitWriter", () => {
  const call = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let repositories: RepositoryReader;
  let statuses: StatusReader;
  let hooks: HooksReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    runner = new ProgramRunner(supervisor.context);
    repositories = new RepositoryReader(runner, new GitVersionReader(runner));
    statuses = new StatusReader(runner);
    hooks = new HooksReader(runner);
  });

  afterEach(async () => {
    await supervisor.disposeAsync();
    await repository.disposeAsync();
  });

  const readAsync = async (): Promise<[RepositoryFolders, GitStatus]> => {
    const folders = await repositories.readAsync(repository.folder);
    return [folders, await statuses.readAsync(folders)];
  };
  const hookAsync = async (name: string, exitCode: number): Promise<void> => {
    const file = path.join(repository.gitFolder, "hooks", name);
    await writeFile(file, `#!/bin/sh\nexit ${exitCode}\n`);
    await chmod(file, 0o755);
  };
  const failsWith = (type: abstract new (...args: never[]) => GitFailureException, code: FailureCode, gitCode: GitCode | null) => (error: unknown): boolean =>
    error instanceof type && error.code === code && error.gitCode === gitCode;

  test("refuses a commit with nothing staged, or with conflicts left", async () => {
    const write = new CommitWriter(runner, hooks, "Message");
    await repository.writeAsync("a.txt", "unstaged\n");
    const [, unstaged] = await readAsync();
    assert.throws(() => write.refuse(unstaged), failsWith(NothingStagedException, FailureCode.Git, GitCode.NothingToCommit));

    await repository.runGitAsync(["stash", "--quiet"]);
    await repository.runGitAsync(["checkout", "--quiet", "-b", "other"]);
    await repository.writeAsync("a.txt", "theirs\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Theirs"]);
    await repository.runGitAsync(["checkout", "--quiet", "main"]);
    await repository.writeAsync("a.txt", "ours\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Ours"]);
    await assert.rejects(repository.runGitAsync(["merge", "--quiet", "other"]));
    const [, conflicted] = await readAsync();
    assert.throws(() => write.refuse(conflicted), failsWith(CommitConflictsException, FailureCode.Git, GitCode.Conflict));
  });

  test("asks an agent's commit at medium risk with the message, the staged files, the author and the hooks that will run", async () => {
    await repository.runGitAsync(["mv", "a.txt", "c.txt"]);
    await repository.writeAsync("b.txt", "new\n");
    await repository.writeAsync("d.txt", "not staged\n");
    await repository.runGitAsync(["add", "b.txt"]);
    await hookAsync("pre-commit", 0);
    await hookAsync("commit-msg", 0);
    const [folders, status] = await readAsync();
    const write = new CommitWriter(runner, hooks, "Add b\n\n# kept as written");

    assert.doesNotThrow(() => write.refuse(status));
    assert.deepEqual(await write.requestAsync(folders, status, call), {
      action: "git.commit",
      subject: folders.top,
      title: "Commit 2 files to main",
      details: [
        { label: "Message", kind: PermissionDetailKind.AgentText, value: "Add b\n\n# kept as written" },
        { label: "Files", kind: PermissionDetailKind.Code, value: "A b.txt\nR a.txt → c.txt" },
        { label: "Author", kind: PermissionDetailKind.Text, value: "Noldova Test <test@example.invalid> (from your Git settings)" },
        { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "pre-commit, commit-msg" }
      ],
      risk: ToolRisk.Medium,
      options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny],
      labels: { [PermissionOption.AllowAlways]: "Always allow in this repository" }
    });
  });

  test("names a detached HEAD and no hooks", async () => {
    await repository.runGitAsync(["switch", "--quiet", "--detach"]);
    await repository.writeAsync("a.txt", "changed\n");
    await repository.runGitAsync(["add", "a.txt"]);
    const [folders, status] = await readAsync();

    const asked = await new CommitWriter(runner, hooks, "Change a").requestAsync(folders, status, call);

    assert.equal(asked?.title, "Commit 1 file on a detached HEAD");
    assert.deepEqual(asked?.details.slice(1).map(t => t.value), ["M a.txt", "Noldova Test <test@example.invalid> (from your Git settings)", "None"]);
  });

  test("refuses to ask when the status was cut short, and fails with git's output when git has no identity", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    await repository.runGitAsync(["add", "a.txt"]);
    const [folders, status] = await readAsync();
    const write = new CommitWriter(runner, hooks, "Change a");

    await assert.rejects(write.requestAsync(folders, new GitStatus(status.branch, status.head, status.upstream, status.entries, true, status.fingerprint, status.operation, status.remote), call), failsWith(RequestTooLargeException, FailureCode.Refused, null));
    await repository.runGitAsync(["config", "user.name", ""]);
    await assert.rejects(write.requestAsync(folders, status, call), failsWith(GitFailedException, FailureCode.Unavailable, null));
  });

  test("commits what is staged with the message as written, running the person's hooks", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    await repository.writeAsync("b.txt", "not staged\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await hookAsync("pre-commit", 0);

    await new CommitWriter(runner, hooks, "Change a\n\n# kept as written").runAsync(...await readAsync());

    assert.equal((await repository.runGitAsync(["log", "-1", "--format=%B"])).trimEnd(), "Change a\n\n# kept as written");
    assert.equal(await repository.runGitAsync(["status", "--porcelain=v1", "--untracked-files=all"]), "?? b.txt\n");
    assert.ok(supervisor.requests.some(t => t.arguments.join(" ").endsWith(" commit --quiet --cleanup=whitespace --message=Change a\n\n# kept as written")));
  });

  test("fails as HookFailed when a hook refuses, and with git's output for any other failure", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await hookAsync("pre-commit", 1);
    await assert.rejects(new CommitWriter(runner, hooks, "Change a").runAsync(...await readAsync()), failsWith(CommitHookFailedException, FailureCode.Git, GitCode.HookFailed));
    assert.equal((await repository.runGitAsync(["log", "--format=%s"])).trim(), "Start");
  });

  test("fails with git's output, never as HookFailed, when signing stops a commit that a hook could refuse", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await repository.runGitAsync(["config", "commit.gpgSign", "true"]);
    await repository.runGitAsync(["config", "gpg.program", path.join(repository.root, "missing-gpg")]);
    await hookAsync("pre-commit", 0);

    await assert.rejects(new CommitWriter(runner, hooks, "Change a").runAsync(...await readAsync()), (error: unknown) =>
      failsWith(GitFailedException, FailureCode.Unavailable, null)(error) && error instanceof GitFailedException && error.output?.text.includes("failed to write commit object") === true);
  });

  test("fails with git's output, never as HookFailed, when the message is empty after cleanup", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await hookAsync("commit-msg", 0);

    await assert.rejects(new CommitWriter(runner, hooks, " \n ").runAsync(...await readAsync()), (error: unknown) =>
      failsWith(GitFailedException, FailureCode.Unavailable, null)(error) && error instanceof GitFailedException && error.output?.text.startsWith("Aborting commit") === true);
  });

  test("fails with git's output, never as HookFailed, when nothing is staged by the time it runs", async () => {
    await hookAsync("pre-commit", 0);

    await assert.rejects(new CommitWriter(runner, hooks, "Change a").runAsync(...await readAsync()), failsWith(GitFailedException, FailureCode.Unavailable, null));
  });

  test("fails with git's output when a commit fails without a hook that could refuse it", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await hookAsync("post-commit", 1);
    await repository.runGitAsync(["config", "commit.gpgSign", "true"]);
    await repository.runGitAsync(["config", "gpg.program", path.join(repository.root, "missing-gpg")]);

    await assert.rejects(new CommitWriter(runner, hooks, "Change a").runAsync(...await readAsync()), failsWith(GitFailedException, FailureCode.Unavailable, null));
  });

  test("shows the hooks as unknown when they can't be read, and fails a refused commit with git's output, never as HookFailed", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await hookAsync("pre-commit", 1);
    const unreadable = path.join(repository.gitFolder, "hooks", "prepare-commit-msg");
    await symlink(unreadable, unreadable, "junction");
    const [folders, status] = await readAsync();

    assert.equal((await new CommitWriter(runner, hooks, "Change a").requestAsync(folders, status, call))?.details.at(-1)?.value, "Unknown: the hooks couldn't be read, so any of them may run");
    await assert.rejects(new CommitWriter(runner, hooks, "Change a").runAsync(folders, status), failsWith(GitFailedException, FailureCode.Unavailable, null));
  });
});
