/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { UntrustedSource } from "@noldova/git.protocol";

import { BranchExistsException } from "../../src/exceptions/branch-exists.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { BranchAtWriter } from "../../src/services/branch-at.writer.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("BranchAtWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.writeAsync("a.txt", "second\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Second"]);
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
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const runAsync = async (write: BranchAtWriter): Promise<void> => {
    const folders = await new RepositoryReader(runner, new GitVersionReader(runner)).readAsync(repository.folder);
    await write.runAsync(folders, await new StatusReader(runner).readAsync(folders));
  };
  const idOf = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();

  test("makes a branch at the commit without switching to it, without upstream, keeping local changes, and never asks", async () => {
    const first = await idOf("HEAD~1");
    await repository.writeAsync("a.txt", "local\n");
    const write = new BranchAtWriter(runner, "fix/old", first);
    assert.doesNotThrow(() => write.refuse());
    assert.equal(await write.requestAsync(), null);

    await runAsync(write);

    assert.deepEqual([await idOf("fix/old"), (await repository.runGitAsync(["branch", "--show-current"])).trim(), await repository.runGitAsync(["status", "--porcelain=v1"])],
      [first, "main", " M a.txt\n"]);
  });

  test("refuses a name a branch already has, and fails with git's errors for a commit it doesn't know", async () => {
    await assert.rejects(runAsync(new BranchAtWriter(runner, "main", await idOf("HEAD~1"))), (error: unknown) =>
      error instanceof BranchExistsException && error.branch === "main");
    await assert.rejects(runAsync(new BranchAtWriter(runner, "lost", "f".repeat(40))), (error: unknown) =>
      error instanceof GitFailedException && error.output?.source === UntrustedSource.Repository);
    assert.equal((await repository.runGitAsync(["branch", "--list", "lost"])).trim(), "");
  });
});
