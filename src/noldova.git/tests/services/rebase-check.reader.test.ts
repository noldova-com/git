/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { GitRebaseStepCheck, RebaseAction, RebaseCheckOutcome, RebaseStep, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { Resources } from "../../src/resources.ts";
import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { RebaseCheckReader } from "../../src/services/rebase-check.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

/** A rebase step the test plans, by the revision it names and the action it takes. */
interface IPlannedStep {
  readonly revision: string;
  readonly action: RebaseAction;
}

describe("RebaseCheckReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ScriptedRunnerFixture;
  let reader: RebaseCheckReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["switch", "--quiet", "--create", "feature"]);
    await template.writeAsync("a.txt", "feature a\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Change a"]);
    await template.writeAsync("b.txt", "b\n");
    await template.runGitAsync(["add", "b.txt"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Add b"]);
    await template.writeAsync("b.txt", "b fixed\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "fixup! Add b"]);
    await template.writeAsync("c.txt", "debug\n");
    await template.runGitAsync(["add", "c.txt"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "WIP debug"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
    await template.writeAsync("a.txt", "main a\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Change a on main"]);
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new ScriptedRunnerFixture(supervisor.context);
    reader = new RebaseCheckReader(runner, new GitVersionReader(runner), new FilterOptionsReader(runner));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  /** A check's steps on the git these tests run: each unavailable on a git older than 2.45, whose merge-tree merges no trees, as Apple's git on a Mac. */
  const onThisGitAsync = async (steps: readonly GitRebaseStepCheck[]): Promise<readonly GitRebaseStepCheck[]> =>
    await repository.hasGitAsync(Resources.mergeTreesVersion) ? steps : steps.map(() => new GitRebaseStepCheck(RebaseCheckOutcome.Unavailable, []));
  const idOf = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();
  const checkAsync = async (onto: string, steps: readonly IPlannedStep[]): Promise<readonly GitRebaseStepCheck[]> => {
    const resolved = await Promise.all(steps.map(async ({ revision, action }) => new RebaseStep(await idOf(revision), action, action === RebaseAction.Reword || action === RebaseAction.Squash ? "Message" : null)));
    return (await reader.readAsync(repository.folder, await idOf(onto), resolved)).steps;
  };

  test("checks each step against the target and the steps before it: a conflict with its paths, a clean pick, a folded fixup and a dropped step, or each unavailable on a git older than 2.45", async () => {
    assert.deepEqual(await checkAsync("main", [
      { revision: "feature~3", action: RebaseAction.Pick },
      { revision: "feature~2", action: RebaseAction.Reword },
      { revision: "feature~1", action: RebaseAction.Fixup },
      { revision: "feature", action: RebaseAction.Drop }
    ]), await onThisGitAsync([
      new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["a.txt"]),
      new GitRebaseStepCheck(RebaseCheckOutcome.Clean, []),
      new GitRebaseStepCheck(RebaseCheckOutcome.Folded, []),
      new GitRebaseStepCheck(RebaseCheckOutcome.Dropped, [])
    ]));
  });

  test("replays each step on what the steps before it left, so a step moved above the commit it builds on conflicts, and a squash after it folds, or each unavailable on a git older than 2.45", async () => {
    assert.deepEqual(await checkAsync("feature~3", [
      { revision: "feature~1", action: RebaseAction.Pick },
      { revision: "feature~2", action: RebaseAction.Pick }
    ]), await onThisGitAsync([new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["b.txt"]), new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["b.txt"])]));
    assert.deepEqual(await checkAsync("feature~3", [
      { revision: "feature~2", action: RebaseAction.Edit },
      { revision: "feature~1", action: RebaseAction.Squash }
    ]), await onThisGitAsync([new GitRebaseStepCheck(RebaseCheckOutcome.Clean, []), new GitRebaseStepCheck(RebaseCheckOutcome.Folded, [])]));
  });

  test("answers every step unavailable on a git older than 2.45, whose merge-tree merges no trees, or while the repository's configuration names a merge driver", async () => {
    const steps: readonly IPlannedStep[] = [{ revision: "feature~3", action: RebaseAction.Pick }, { revision: "feature", action: RebaseAction.Drop }];
    const unavailable = [new GitRebaseStepCheck(RebaseCheckOutcome.Unavailable, []), new GitRebaseStepCheck(RebaseCheckOutcome.Unavailable, [])];
    runner.answering = ["version", "git version 2.44.0\n"];
    assert.deepEqual(await checkAsync("main", steps), unavailable);

    runner.answering = null;
    await repository.runGitAsync(["config", "merge.mine.driver", "false"]);
    assert.deepEqual(await checkAsync("main", steps), unavailable);
  });

  test("fails with git's errors, marked untrusted, when merge-tree fails or its output is cut short", async () => {
    runner.answering = ["version", "git version 2.45.0\n"];
    const failsWith = (error: unknown): boolean =>
      error instanceof GitFailedException && error.message.includes("merge-tree") && error.output?.source === UntrustedSource.Repository;
    const main = await idOf("main");

    await assert.rejects(reader.readAsync(repository.folder, main, [new RebaseStep("f".repeat(40), RebaseAction.Pick, null)]), failsWith);
    runner.truncating = "merge-tree";
    await assert.rejects(checkAsync("main", [{ revision: "feature~2", action: RebaseAction.Pick }]), failsWith);
  });
});
