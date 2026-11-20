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
import { FailureCode, type GitStatus, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { UnstageWriter } from "../../src/services/unstage.writer.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("UnstageWriter", () => {
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

  const readAsync = async (folder: string = repository.folder): Promise<[RepositoryFolders, GitStatus]> => {
    const folders = await repositories.readAsync(folder);
    return [folders, await statuses.readAsync(folders)];
  };
  const stagedAsync = async (folder: string = repository.folder): Promise<string> =>
    await repository.runGitAsync(["-C", folder, "status", "--porcelain=v1", "--untracked-files=all"]);
  const hookAsync = async (name: string): Promise<void> => {
    const file = path.join(repository.gitFolder, "hooks", name);
    await writeFile(file, "#!/bin/sh\nexit 0\n");
    await chmod(file, 0o755);
  };
  const call = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };
  const unavailable = (command: string) => (error: unknown): boolean => error instanceof GitFailedException && error.code === FailureCode.Unavailable
    && error.message === `git ${command} failed; its output comes with the failure as untrusted text.`
    && error.output?.source === UntrustedSource.Repository && error.output.text.length > 0;

  test("never refuses, and never asks while no hook of the repository would run: unstaging is a person's to undo", async () => {
    await hookAsync("pre-commit");
    const write = new UnstageWriter(runner, hooks, ["a.txt"]);

    assert.doesNotThrow(() => write.refuse());
    assert.equal(await write.requestAsync(...await readAsync(), call), null);
  });

  test("asks an agent's unstage at low risk when a hook would run, with the paths and the hook", async () => {
    await hookAsync("post-index-change");
    const [folders, status] = await readAsync();

    assert.deepEqual(await new UnstageWriter(runner, hooks, ["a.txt", "dir/b\u001b.txt"]).requestAsync(folders, status, call), {
      action: "git.unstage",
      subject: folders.top,
      title: "Unstage 2 paths",
      details: [
        { label: "Files", kind: PermissionDetailKind.Code, value: "a.txt\ndir/b\ufffd.txt" },
        { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "post-index-change" }
      ],
      risk: ToolRisk.Low,
      options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny],
      labels: { [PermissionOption.AllowAlways]: "Always allow in this repository" }
    });
  });

  test("asks an agent's unstage at low risk when the repository's hooks can't be read, saying so", async () => {
    const hook = path.join(repository.gitFolder, "hooks", "post-index-change");
    await symlink(hook, hook, "junction");
    const [folders, status] = await readAsync();
    const write = new UnstageWriter(runner, hooks, ["a.txt"]);

    const asked = await write.requestAsync(folders, status, call);
    assert.equal(asked?.risk, ToolRisk.Low);
    assert.deepEqual(asked?.details.at(-1), { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "Unknown: the hooks couldn't be read, so any of them may run" });
  });

  test("unstages from HEAD, keeping the worktree's change", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    await repository.runGitAsync(["add", "a.txt"]);

    await new UnstageWriter(runner, hooks, ["a.txt"]).runAsync(...await readAsync());

    assert.equal(await stagedAsync(), " M a.txt\n");
  });

  test("unstages before the first commit by taking the file out of the index, also when the worktree changed it since", async () => {
    const empty = path.join(repository.root, "empty");
    await repository.runGitAsync(["init", "--quiet", empty]);
    await repository.writeAsync(path.join("..", "empty", "f.txt"), "staged\n");
    await repository.runGitAsync(["-C", empty, "add", "f.txt"]);
    await repository.writeAsync(path.join("..", "empty", "f.txt"), "edited\n");

    await new UnstageWriter(runner, hooks, ["f.txt"]).runAsync(...await readAsync(empty));

    assert.equal(await stagedAsync(empty), "?? f.txt\n");
  });

  test("fails with git's output when git can't unstage a path, from HEAD and before the first commit", async () => {
    await assert.rejects(new UnstageWriter(runner, hooks, ["missing.txt"]).runAsync(...await readAsync()), unavailable("restore --staged"));

    const empty = path.join(repository.root, "empty");
    await repository.runGitAsync(["init", "--quiet", empty]);
    await assert.rejects(new UnstageWriter(runner, hooks, ["missing.txt"]).runAsync(...await readAsync(empty)), unavailable("rm --cached"));
  });
});
