/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { GitPrediction, PredictionAction, PredictionOutcome, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { Resources } from "../../src/resources.ts";
import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { PredictionReader } from "../../src/services/prediction.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("PredictionReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ScriptedRunnerFixture;
  let reader: PredictionReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["switch", "--quiet", "--create", "side"]);
    await template.writeAsync("b.txt", "side\n");
    await template.runGitAsync(["add", "b.txt"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Add b"]);
    await template.writeAsync("a.txt", "side a\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Change a on side"]);
    await template.runGitAsync(["switch", "--quiet", "--create", "clean", "main"]);
    await template.writeAsync("c.txt", "clean\n");
    await template.runGitAsync(["add", "c.txt"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Add c"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
    await template.writeAsync("a.txt", "main a\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Change a on main"]);
    await template.writeAsync("a.txt", "main a again\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Change a on main again"]);
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
    reader = new PredictionReader(runner, new GitVersionReader(runner), new FilterOptionsReader(runner));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const onThisGitAsync = async (predictions: readonly GitPrediction[]): Promise<readonly GitPrediction[]> =>
    await repository.hasGitAsync(Resources.mergeBaseOptionVersion) ? predictions : predictions.map(() => new GitPrediction(PredictionOutcome.Unavailable, []));
  const idOf = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();
  const predictAsync = async (revision: string, action: PredictionAction): Promise<GitPrediction> =>
    reader.readAsync(repository.folder, await idOf(revision), action);

  test("predicts a merge of an ancestor as up to date, of a descendant as a fast-forward, and of a diverged commit as clean or with its conflicting paths", async () => {
    await repository.runGitAsync(["switch", "--quiet", "--create", "ahead"]);
    await repository.writeAsync("d.txt", "ahead\n");
    await repository.runGitAsync(["add", "d.txt"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add d"]);
    await repository.runGitAsync(["switch", "--quiet", "main"]);
    const before = await repository.runGitAsync(["status", "--porcelain=v1", "--branch"]);

    assert.deepEqual([
      await predictAsync("main~1", PredictionAction.Merge),
      await predictAsync("ahead", PredictionAction.Merge),
      await predictAsync("clean", PredictionAction.Merge),
      await predictAsync("side", PredictionAction.Merge)
    ], [new GitPrediction(PredictionOutcome.UpToDate, []), new GitPrediction(PredictionOutcome.FastForward, []), new GitPrediction(PredictionOutcome.Clean, []), new GitPrediction(PredictionOutcome.Conflicts, ["a.txt"])]);
    assert.equal(await repository.runGitAsync(["status", "--porcelain=v1", "--branch"]), before);
  });

  test("predicts a cherry-pick against the commit's first parent, as clean, conflicting, up to date when it would change nothing, and unavailable for a root commit, or each unavailable on a git older than 2.40", async () => {
    assert.deepEqual([
      await predictAsync("side~1", PredictionAction.CherryPick),
      await predictAsync("side", PredictionAction.CherryPick),
      await predictAsync("HEAD", PredictionAction.CherryPick),
      await predictAsync("main~2", PredictionAction.CherryPick)
    ], await onThisGitAsync([new GitPrediction(PredictionOutcome.Clean, []), new GitPrediction(PredictionOutcome.Conflicts, ["a.txt"]), new GitPrediction(PredictionOutcome.UpToDate, []), new GitPrediction(PredictionOutcome.Unavailable, [])]));
  });

  test("predicts a revert as clean, conflicting, up to date when its change isn't here, and unavailable for a root commit, or each unavailable on a git older than 2.40", async () => {
    assert.deepEqual([
      await predictAsync("HEAD", PredictionAction.Revert),
      await predictAsync("HEAD~1", PredictionAction.Revert),
      await predictAsync("clean", PredictionAction.Revert),
      await predictAsync("main~2", PredictionAction.Revert)
    ], await onThisGitAsync([new GitPrediction(PredictionOutcome.Clean, []), new GitPrediction(PredictionOutcome.Conflicts, ["a.txt"]), new GitPrediction(PredictionOutcome.UpToDate, []), new GitPrediction(PredictionOutcome.Unavailable, [])]));
  });

  test("answers a cherry-pick and a revert as unavailable on a git older than 2.40, whose merge-tree takes no merge base, while a merge still predicts", async () => {
    runner.answering = ["version", "git version 2.39.5\n"];

    assert.deepEqual([
      await predictAsync("side~1", PredictionAction.CherryPick),
      await predictAsync("HEAD", PredictionAction.Revert),
      await predictAsync("side", PredictionAction.Merge)
    ], [new GitPrediction(PredictionOutcome.Unavailable, []), new GitPrediction(PredictionOutcome.Unavailable, []), new GitPrediction(PredictionOutcome.Conflicts, ["a.txt"])]);
  });

  test("answers unavailable, running nothing more, when the repository's own configuration names a merge driver, and switches its own filters off for merge-tree", async () => {
    const commands: string[] = [];
    runner.starting = command => commands.push(command);
    await repository.runGitAsync(["config", "filter.mine.clean", "false"]);

    assert.deepEqual(await predictAsync("clean", PredictionAction.Merge), new GitPrediction(PredictionOutcome.Clean, []));
    assert.ok(commands.some(t => t.includes("-c filter.mine.clean= -c filter.mine.process= -c filter.mine.required=false merge-tree --write-tree")), commands.join("\n"));
    await repository.runGitAsync(["config", "merge.mine.driver", "false"]);
    commands.length = 0;

    assert.deepEqual(await predictAsync("side", PredictionAction.Merge), new GitPrediction(PredictionOutcome.Unavailable, []));
    assert.deepEqual(commands.map(t => t.split(" ")[0]), ["config"]);
  });

  test("fails with git's errors, marked untrusted, when a command it runs fails or its output is cut short", async () => {
    const failsWith = (command: string) => (error: unknown): boolean =>
      error instanceof GitFailedException && error.message.includes(command) && error.output?.source === UntrustedSource.Repository;
    const unknown = "f".repeat(40);

    await assert.rejects(reader.readAsync(repository.folder, unknown, PredictionAction.Merge), failsWith("merge-base"));
    runner.answering = ["version", "git version 2.40.0\n"];
    await assert.rejects(reader.readAsync(repository.folder, unknown, PredictionAction.CherryPick), failsWith("rev-parse"));
    runner.answering = null;
    runner.failing = "merge-tree";
    runner.failingCode = 128;
    await assert.rejects(predictAsync("side", PredictionAction.Merge), failsWith("merge-tree"));
    runner.failing = "--get-regexp";
    runner.failingCode = 2;
    await assert.rejects(predictAsync("side", PredictionAction.Merge), failsWith("config"));
    runner.failing = null;
    runner.truncating = "merge-tree";
    await assert.rejects(predictAsync("side", PredictionAction.Merge), failsWith("merge-tree"));
  });
});
