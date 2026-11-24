/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { FailureCode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { RebaseTooLongException } from "../../src/exceptions/rebase-too-long.exception.ts";
import { RebasePlanReader } from "../../src/services/rebase-plan.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("RebasePlanReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ScriptedRunnerFixture;
  let reader: RebasePlanReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["switch", "--quiet", "--create", "feature"]);
    for (const [file, subject] of [["b.txt", "Add b"], ["c.txt", "Add c"], ["b.txt", "fixup! Add b"], ["d.txt", "squash! fixup! Add c"]] as const) {
      await template.writeAsync(file, `${subject}\n`);
      await template.runGitAsync(["add", file]);
      await template.runGitAsync(["commit", "--quiet", "-m", subject, "-m", "Body line."]);
    }
    await template.runGitAsync(["branch", "stacked", "HEAD~2"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
    await template.writeAsync("e.txt", "main\n");
    await template.runGitAsync(["add", "e.txt"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Add e"]);
    await template.runGitAsync(["switch", "--quiet", "feature"]);
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
    reader = new RebasePlanReader(runner);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const idOf = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();

  test("lists the branch's commits past the base oldest first, pairs fold commits with their targets, and names the other branches on them", async () => {
    const main = await idOf("main");
    const plan = await reader.readAsync(repository.folder, main);

    assert.equal(plan.branch, "feature");
    assert.equal(plan.onto, main);
    assert.equal(plan.base, await idOf("main~1"));
    assert.equal(plan.ontoAhead, 1);
    const [b, c, fixup, squash] = await Promise.all(["HEAD~3", "HEAD~2", "HEAD~1", "HEAD"].map(idOf));
    assert.deepEqual(plan.commits.map(t => [t.id, t.message, t.fixupOf]), [
      [b, "Add b\n\nBody line.", null],
      [c, "Add c\n\nBody line.", null],
      [fixup, "fixup! Add b\n\nBody line.", b],
      [squash, "squash! fixup! Add c\n\nBody line.", c]
    ]);
    assert.deepEqual(plan.stacked, ["stacked"]);
    assert.equal(plan.pushed, false);
  });

  test("pairs a fold commit by an id prefix, the nearest earlier match first, and leaves a fold naming nothing earlier unpaired", () => {
    const first = "a".repeat(40);
    const second = "b".repeat(40);
    const paired = RebasePlanReader.pair([
      [first, "Same"],
      [second, "Same"],
      ["c".repeat(40), "fixup! Same"],
      ["d".repeat(40), "amend! aaaa"],
      ["e".repeat(40), "fixup! aaa"],
      ["f".repeat(40), "squash! Missing"],
      ["1".repeat(40), "Not a fixup! Same"]
    ]);

    assert.deepEqual(paired.map(t => t.fixupOf), [null, null, second, first, null, null, null]);
  });

  test("reads a detached HEAD as no branch, and an empty plan when HEAD is already on the commit", async () => {
    const head = await idOf("HEAD");
    await repository.runGitAsync(["switch", "--quiet", "--detach"]);
    const plan = await reader.readAsync(repository.folder, head);

    assert.equal(plan.branch, null);
    assert.deepEqual(plan.commits, []);
    assert.deepEqual(plan.stacked, []);
    assert.equal(plan.ontoAhead, 0);
    assert.equal(plan.pushed, false);
  });

  test("reads whether the branch's upstream already has the oldest commit it would replay", async () => {
    const main = await idOf("main");
    await repository.runGitAsync(["remote", "add", "origin", repository.folder]);
    await repository.runGitAsync(["config", "branch.feature.remote", "origin"]);
    await repository.runGitAsync(["config", "branch.feature.merge", "refs/heads/feature"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/feature", "main~1"]);
    assert.equal((await reader.readAsync(repository.folder, main)).pushed, false);

    await repository.runGitAsync(["update-ref", "refs/remotes/origin/feature", "HEAD~3"]);
    assert.equal((await reader.readAsync(repository.folder, main)).pushed, true);
  });

  test("refuses a branch with more commits past the base than a rebase lists, before reading them", async () => {
    const commands: string[] = [];
    runner.starting = command => commands.push(command);
    runner.answering = ["rev-list --count --no-merges", "501\n"];

    await assert.rejects(reader.readAsync(repository.folder, await idOf("main")),
      (error: unknown) => error instanceof RebaseTooLongException && error.code === FailureCode.TooLarge);
    assert.equal(commands.some(t => t.startsWith("log")), false);
  });

  test("fails with git's errors, marked untrusted, when a command it runs fails or its output is cut short", async () => {
    const failsWith = (command: string) => (error: unknown): boolean =>
      error instanceof GitFailedException && error.message.includes(command) && error.output?.source === UntrustedSource.Repository;
    const main = await idOf("main");
    await repository.runGitAsync(["remote", "add", "origin", repository.folder]);
    await repository.runGitAsync(["config", "branch.feature.remote", "origin"]);
    await repository.runGitAsync(["config", "branch.feature.merge", "refs/heads/feature"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/feature", "main~1"]);

    await assert.rejects(reader.readAsync(repository.folder, "f".repeat(40)), failsWith("merge-base"));
    runner.failing = "--is-ancestor";
    runner.failingCode = 128;
    await assert.rejects(reader.readAsync(repository.folder, main), failsWith("merge-base"));
    runner.failing = null;
    runner.truncating = "--topo-order";
    await assert.rejects(reader.readAsync(repository.folder, main), failsWith("log"));
  });
});
