/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, onTestFinished, test, vi } from "vitest";

import { FailureCode, GitCode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { WorktreeListParser } from "../../src/services/worktree-list.parser.ts";
import { WorktreesReader } from "../../src/services/worktrees.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("WorktreesReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let reader: WorktreesReader;

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
    reader = new WorktreesReader(new ProgramRunner(supervisor.context));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  test("reads the main worktree first, then the linked ones in git's order by folder, with each one's head, branch, lock and prune state", async () => {
    const side = path.join(repository.root, "side");
    const review = path.join(repository.root, "review");
    const gone = path.join(repository.root, "gone");
    await repository.runGitAsync(["worktree", "add", "--quiet", "-b", "side", side]);
    await repository.runGitAsync(["worktree", "add", "--quiet", "--detach", review]);
    await repository.runGitAsync(["worktree", "lock", "--reason", "an agent works here", review]);
    await repository.runGitAsync(["worktree", "add", "--quiet", "-b", "gone", gone]);
    await rm(gone, { recursive: true, force: true });
    const head = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();

    const worktrees = (await reader.readAsync(repository.folder)).worktrees;

    assert.deepEqual(worktrees.map(t => [path.resolve(t.path), t.head, t.branch, t.locked, t.prunable]), [
      [path.resolve(repository.folder), head, "main", false, false],
      [path.resolve(gone), head, "gone", false, true],
      [path.resolve(review), head, null, true, false],
      [path.resolve(side), head, "side", false, false]
    ]);
  });

  test("names no head before the first commit", async () => {
    const empty = path.join(repository.root, "empty");
    await repository.runGitAsync(["init", "--quiet", "--initial-branch=start", empty]);

    assert.deepEqual((await reader.readAsync(empty)).worktrees.map(t => [t.head, t.branch]), [[null, "start"]]);
  });

  test("names no head for a bare repository, and fails with git's errors marked untrusted, on a list past its limit and on a worktree the protocol refuses", async () => {
    const outside = path.join(repository.root, "outside");
    await mkdir(outside);
    await assert.rejects(reader.readAsync(outside), (error: unknown) =>
      error instanceof GitFailedException && error.code === FailureCode.Unavailable && error.output?.source === UntrustedSource.Repository &&
      error.message === "git worktree list failed; its output comes with the failure as untrusted text." && /not a git repository/v.test(error.output?.text ?? ""));
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const failing = new WorktreesReader(runner);
    runner.truncating = "worktree";
    await assert.rejects(failing.readAsync(repository.folder), { name: "WorktreeListTruncatedException", code: FailureCode.Unavailable, message: "The repository's worktree list is longer than the module reads." });
    runner.truncating = null;
    const NUL = String.fromCharCode(0);
    const bare = path.join(repository.root, "bare.git");
    await repository.runGitAsync(["init", "--quiet", "--bare", bare]);
    const [worktree] = (await reader.readAsync(bare)).worktrees;
    assert.deepEqual([path.resolve(worktree?.path ?? ""), worktree?.head, worktree?.branch, worktree?.locked, worktree?.prunable], [bare, null, null, false, false]);
    runner.answering = ["worktree", "worktree relative" + NUL + "HEAD " + "a".repeat(40) + NUL + NUL];
    await assert.rejects(failing.readAsync(repository.folder), {
      name: "UnreadableOutputException",
      code: FailureCode.Git,
      gitCode: GitCode.UnreadableOutput,
      message: "git worktree list printed worktrees that the module can't read."
    });
  });

  test("lets through a failure of its own reading that isn't a value the protocol refuses", async () => {
    const failure = new RangeError("The parser broke.");
    const parse = vi.spyOn(WorktreeListParser, "parse").mockImplementationOnce(() => {
      throw failure;
    });
    onTestFinished(() => parse.mockRestore());

    await assert.rejects(reader.readAsync(repository.folder), failure);
  });
});
