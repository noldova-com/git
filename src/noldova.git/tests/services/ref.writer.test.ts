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
import { TagExistsException } from "../../src/exceptions/tag-exists.exception.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RefWriter } from "../../src/services/ref.writer.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("RefWriter", () => {
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

  const runAsync = async (write: RefWriter): Promise<void> => {
    const folders = await new RepositoryReader(runner, new GitVersionReader(runner)).readAsync(repository.folder);
    await write.runAsync(folders, await new StatusReader(runner).readAsync(folders));
  };
  const idOf = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();

  const branchOf = (gitArguments: readonly string[], taken: string | null = null): RefWriter =>
    new RefWriter(runner, "git.renameBranch", gitArguments, "branch", taken === null ? null : new BranchExistsException(taken));
  const tagOf = (gitArguments: readonly string[], taken: string | null = null): RefWriter =>
    new RefWriter(runner, "git.createTag", gitArguments, "update-ref", taken === null ? null : new TagExistsException(taken));
  const refsOf = async (pattern: string): Promise<string> => (await repository.runGitAsync(["for-each-ref", "--format=%(refname:short)", pattern])).trim();

  test("renames a branch and deletes a merged one, keeping local changes and the current branch, and never asks", async () => {
    await repository.runGitAsync(["branch", "old"]);
    await repository.runGitAsync(["branch", "done"]);
    await repository.writeAsync("a.txt", "local\n");
    const write = branchOf(["branch", "--move", "old", "new"], "new");
    assert.doesNotThrow(() => write.refuse());
    assert.deepEqual([write.method, write.undo], ["git.renameBranch", "Refs"]);
    assert.equal(await write.requestAsync(), null);

    await runAsync(write);
    await runAsync(branchOf(["branch", "--delete", "done"]));

    assert.deepEqual([await refsOf("refs/heads"), (await repository.runGitAsync(["branch", "--show-current"])).trim(), await repository.runGitAsync(["status", "--porcelain=v1"])],
      ["main\nnew", "main", " M a.txt\n"]);
  });

  test("refuses a new name a branch already has, and fails with git's errors for an unmerged branch or the current one, deleting neither", async () => {
    await repository.runGitAsync(["branch", "other"]);
    await repository.runGitAsync(["checkout", "--quiet", "-b", "ahead"]);
    await repository.writeAsync("a.txt", "ahead\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Ahead"]);
    await repository.runGitAsync(["checkout", "--quiet", "main"]);

    await assert.rejects(runAsync(branchOf(["branch", "--move", "other", "main"], "main")), (error: unknown) =>
      error instanceof BranchExistsException && error.branch === "main");
    for (const name of ["ahead", "main"])
      await assert.rejects(runAsync(branchOf(["branch", "--delete", name])), (error: unknown) =>
        error instanceof GitFailedException && error.output?.source === UntrustedSource.Repository);
    assert.equal(await refsOf("refs/heads"), "ahead\nmain\nother");
  });

  test("makes a tag at a commit and deletes it, and refuses a name a tag already has, keeping that tag where it was", async () => {
    const first = await idOf("HEAD~1");
    const head = await idOf("HEAD");

    await runAsync(tagOf(["update-ref", "refs/tags/v1", first, ""], "v1"));
    const made = await idOf("v1");
    await assert.rejects(runAsync(tagOf(["update-ref", "refs/tags/v1", head, ""], "v1")), (error: unknown) =>
      error instanceof TagExistsException && error.tag === "v1" && error.message === "The tag v1 already exists. Choose a new name.");
    const kept = await idOf("v1");
    await runAsync(tagOf(["update-ref", "-d", "refs/tags/v1"]));

    assert.deepEqual([made, kept, await refsOf("refs/tags")], [first, first, ""]);
  });

  test("fails with git's errors for a tag at a commit it doesn't know", async () => {
    await assert.rejects(runAsync(tagOf(["update-ref", "refs/tags/lost", "f".repeat(40), ""], "lost")), (error: unknown) =>
      error instanceof GitFailedException && error.output?.source === UntrustedSource.Repository);
    assert.equal(await refsOf("refs/tags"), "");
  });
});
