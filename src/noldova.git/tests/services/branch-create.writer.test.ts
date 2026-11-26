/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { chmod, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FailureCode, GitCode } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { BranchCreateWriter } from "../../src/services/branch-create.writer.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { SessionBranches } from "../../src/services/session-branches.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryState } from "../fixtures/repository-state.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("BranchCreateWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let repositories: RepositoryReader;
  let statuses: StatusReader;
  let hooks: HooksReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["branch", "next"]);
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new ProgramRunner(supervisor.context);
    repositories = new RepositoryReader(runner, new GitVersionReader(runner));
    statuses = new StatusReader(runner);
    hooks = new HooksReader(runner);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const readAsync = async (folder: string = repository.folder): Promise<RepositoryState> => {
    const folders = await repositories.readAsync(folder);
    return new RepositoryState(folders, await statuses.readAsync(folders));
  };
  const currentAsync = async (folder: string = repository.folder): Promise<string> => (await repository.runGitAsync(["-C", folder, "branch", "--show-current"])).trim();
  const hookAsync = async (name: string, hooksFolder: string = path.join(repository.gitFolder, "hooks")): Promise<void> => {
    await mkdir(hooksFolder, { recursive: true });
    const file = path.join(hooksFolder, name);
    await writeFile(file, "#!/bin/sh\nexit 0\n");
    await chmod(file, 0o755);
  };
  const call = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };
  const always = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  const failsWith = (type: abstract new (...args: never[]) => GitFailureException, code: FailureCode, gitCode: GitCode | null, message?: string) => (error: unknown): boolean =>
    error instanceof type && error.code === code && error.gitCode === gitCode && (message === undefined || error.message === message);

  test("creates a branch at the current commit and switches to it, keeping the worktree, and never asks while no hook would run", async () => {
    const branches = new SessionBranches();
    const write = new BranchCreateWriter(runner, hooks, "feature", branches, null);
    await repository.writeAsync("a.txt", "kept\n");
    await hookAsync("pre-push");
    assert.doesNotThrow(() => write.refuse());
    assert.equal(await (await readAsync()).requestAsync(write, call), null);

    await (await readAsync()).runAsync(write);

    assert.equal(await currentAsync(), "feature");
    assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), " M a.txt\n");
    assert.equal(branches.has("session-1", repository.folder, "feature"), false);
  });

  test("gives the new branch no upstream, even when the repository's configuration sets one up for every new branch", async () => {
    await repository.runGitAsync(["config", "branch.autoSetupMerge", "always"]);

    await (await readAsync()).runAsync(new BranchCreateWriter(runner, hooks, "feature", new SessionBranches(), null));

    assert.equal(await currentAsync(), "feature");
    assert.deepEqual((await repository.runGitAsync(["config", "--local", "--list"])).split("\n").filter(t => t.startsWith("branch.feature.")), []);
  });

  test("remembers a branch an agent's session made, as that session's, in its repository", async () => {
    const branches = new SessionBranches();
    const { folders, status } = await readAsync();

    await new BranchCreateWriter(runner, hooks, "agent-branch", branches, "session-1").runAsync(folders, status);

    assert.equal(branches.has("session-1", folders.top, "agent-branch"), true);
  });

  test("asks an agent's create at low risk when a hook would run, naming each one", async () => {
    await hookAsync("post-checkout");
    await hookAsync("reference-transaction");
    const { folders, status } = await readAsync();

    assert.deepEqual(await new BranchCreateWriter(runner, hooks, "feature", new SessionBranches(), "session-1").requestAsync(folders, status, call), {
      action: "git.createBranch",
      subject: folders.top,
      title: "Create the branch feature and switch to it",
      details: [{ label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "post-checkout, reference-transaction" }],
      risk: ToolRisk.Low,
      options: always,
      labels: { [PermissionOption.AllowAlways]: "Always allow in this repository" }
    });
  });

  test("asks an agent's create when the repository's hooks can't be read, saying so", async () => {
    const hook = path.join(repository.gitFolder, "hooks", "post-index-change");
    await symlink(hook, hook, "junction");
    const { folders, status } = await readAsync();
    const hooksDetail = { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "Unknown: the hooks couldn't be read, so any of them may run" };

    assert.deepEqual((await new BranchCreateWriter(runner, hooks, "feature", new SessionBranches(), "session-1").requestAsync(folders, status, call))?.details, [hooksDetail]);
  });

  test("counts a branch as the session's only when no remote has a branch of that name", async () => {
    const remote = path.join(repository.root, "remote.git");
    await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
    await repository.runGitAsync(["-C", remote, "branch", "release-1.2"]);
    await repository.runGitAsync(["remote", "add", "origin", remote]);
    await repository.runGitAsync(["fetch", "--quiet", "origin"]);
    const branches = new SessionBranches();
    const { folders, status } = await readAsync();

    await new BranchCreateWriter(runner, hooks, "release-1.2", branches, "session-1").runAsync(folders, status);
    assert.equal(await currentAsync(), "release-1.2");
    assert.equal(branches.has("session-1", folders.top, "release-1.2"), false);

    await new BranchCreateWriter(runner, hooks, "own", branches, "session-1").runAsync(folders, status);
    assert.equal(branches.has("session-1", folders.top, "own"), true);
  });

  test("names the first branch before the first commit", async () => {
    const empty = path.join(repository.root, "empty");
    await repository.runGitAsync(["init", "--quiet", empty]);

    await (await readAsync(empty)).runAsync(new BranchCreateWriter(runner, hooks, "first", new SessionBranches(), null));

    assert.equal(await currentAsync(empty), "first");
  });

  test("fails with git's output when the branch exists, and remembers nothing", async () => {
    const branches = new SessionBranches();
    const { folders, status } = await readAsync();

    await assert.rejects(new BranchCreateWriter(runner, hooks, "next", branches, "session-1").runAsync(folders, status),
      failsWith(GitFailedException, FailureCode.Unavailable, null, "git switch --no-track failed; its output comes with the failure as untrusted text."));

    assert.equal(branches.has("session-1", folders.top, "next"), false);
    assert.equal(await currentAsync(), "main");
  });

  test("fails with git's output when it can't tell whether the remote has the branch, and creates nothing", async () => {
    const branches = new SessionBranches();
    const { folders, status } = await readAsync();
    const packed = path.join(repository.gitFolder, "packed-refs");
    await writeFile(packed, "not a ref\n");

    await assert.rejects(new BranchCreateWriter(runner, hooks, "agent-branch", branches, "session-1").runAsync(folders, status),
      failsWith(GitFailedException, FailureCode.Unavailable, null, "git for-each-ref failed; its output comes with the failure as untrusted text."));

    await rm(packed);
    assert.equal(branches.has("session-1", folders.top, "agent-branch"), false);
    assert.equal(await currentAsync(), "main");
  });
});
