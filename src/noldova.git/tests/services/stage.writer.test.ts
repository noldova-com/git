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
import { FailureCode, type GitStatus, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StageWriter } from "../../src/services/stage.writer.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("StageWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let repositories: RepositoryReader;
  let statuses: StatusReader;
  let hooks: HooksReader;
  let filters: FilterOptionsReader;

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
    filters = new FilterOptionsReader(runner);
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

  test("never refuses, and never asks while no hook of the repository would run: staging is a person's to undo", async () => {
    await hookAsync("pre-commit");
    const write = new StageWriter(runner, hooks, filters, ["a.txt"]);

    assert.doesNotThrow(() => write.refuse());
    assert.equal(await write.requestAsync(...await readAsync(), call), null);
  });

  test("asks an agent's stage at low risk when a hook would run, with the paths and the hook", async () => {
    await hookAsync("post-index-change");
    const [folders, status] = await readAsync();

    assert.deepEqual(await new StageWriter(runner, hooks, filters, ["a.txt", "dir/b\u001b.txt"]).requestAsync(folders, status, call), {
      action: "git.stage",
      subject: folders.top,
      title: "Stage 2 paths",
      details: [
        { label: "Files", kind: PermissionDetailKind.Code, value: "a.txt\ndir/b\ufffd.txt" },
        { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "post-index-change" }
      ],
      risk: ToolRisk.Low,
      options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny],
      labels: { [PermissionOption.AllowAlways]: "Always allow in this repository" }
    });
    assert.equal((await new StageWriter(runner, hooks, filters, ["a.txt"]).requestAsync(folders, status, call))?.title, "Stage 1 path");
  });

  test("asks an agent's stage at low risk when the repository's hooks can't be read, saying so", async () => {
    const hook = path.join(repository.gitFolder, "hooks", "post-index-change");
    await symlink(hook, hook, "junction");
    const [folders, status] = await readAsync();
    const write = new StageWriter(runner, hooks, filters, ["a.txt"]);

    const asked = await write.requestAsync(folders, status, call);
    assert.equal(asked?.risk, ToolRisk.Low);
    assert.deepEqual(asked?.details.at(-1), { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "Unknown: the hooks couldn't be read, so any of them may run" });
  });

  test("asks an agent's stage at low risk when the repository's own configuration names a clean or process filter, and names it", async () => {
    const own = path.join(repository.configuration, "git");
    await mkdir(own, { recursive: true });
    await repository.runGitAsync(["config", "--file", path.join(own, "config"), "filter.own.clean", "own-filter"]);
    await repository.runGitAsync(["config", "filter.smudged.smudge", "smudge-only"]);
    const write = new StageWriter(runner, hooks, filters, ["a.txt"]);
    const unasked = await write.requestAsync(...await readAsync(), call);
    await repository.runGitAsync(["config", "filter.crypt.clean", "crypt-filter"]);
    await repository.runGitAsync(["config", "filter.lfs.process", "lfs-filter"]);

    const request = await write.requestAsync(...await readAsync(), call);

    assert.equal(unasked, null);
    assert.deepEqual([request?.risk, request?.details], [ToolRisk.Low, [
      { label: "Files", kind: PermissionDetailKind.Code, value: "a.txt" },
      { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "None" },
      { label: "Filters that will run", kind: PermissionDetailKind.Text, value: "crypt, lfs" }
    ]]);
  });

  test("stages a change, a new file and a deletion as the worktree has them", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    await repository.writeAsync("b.txt", "new\n");
    await new StageWriter(runner, hooks, filters, ["a.txt", "b.txt"]).runAsync(...await readAsync());
    assert.equal(await stagedAsync(), "M  a.txt\nA  b.txt\n");

    await repository.runGitAsync(["commit", "--quiet", "-m", "Two"]);
    await rm(path.join(repository.folder, "b.txt"));
    await new StageWriter(runner, hooks, filters, ["b.txt"]).runAsync(...await readAsync());
    assert.equal(await stagedAsync(), "D  b.txt\n");
  });

  test("stages a path whose name looks like a glob as that one file, never the files the glob would match", async () => {
    await repository.writeAsync("[ab].txt", "bracketed\n");
    await repository.writeAsync("a.txt", "changed\n");

    await new StageWriter(runner, hooks, filters, ["[ab].txt"]).runAsync(...await readAsync());

    assert.equal(await stagedAsync(), "A  [ab].txt\n M a.txt\n");
  });

  test("fails with git's output when git refuses to stage, such as an ignored file", async () => {
    await repository.writeAsync(".gitignore", "*.log\n");
    await repository.writeAsync("x.log", "ignored\n");

    await assert.rejects(new StageWriter(runner, hooks, filters, ["x.log"]).runAsync(...await readAsync()), unavailable("add"));
  });
});
