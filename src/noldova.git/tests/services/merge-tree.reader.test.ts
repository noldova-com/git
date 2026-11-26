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

import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { MergeTreeReader } from "../../src/services/merge-tree.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("MergeTreeReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let reader: MergeTreeReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["switch", "--quiet", "-c", "side"]);
    await template.writeAsync("a.txt", "side\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Side"]);
    await template.runGitAsync(["switch", "--quiet", "-"]);
    await template.writeAsync("a.txt", "here\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Here"]);
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    const runner = new ProgramRunner(supervisor.context);
    reader = new MergeTreeReader(runner, new FilterOptionsReader(runner));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const failed = (command: string): object => ({ name: "GitFailedException", code: FailureCode.Unavailable, command, output: { text: "scripted failure\n", source: UntrustedSource.Repository } });

  test("finds a merge driver only in the repository's own configuration", async () => {
    assert.equal(await reader.hasMergeDriversAsync(repository.folder), false);
    await repository.runGitAsync(["config", "--global", "merge.mine.driver", "true"]);
    assert.equal(await reader.hasMergeDriversAsync(repository.folder), false);
    await repository.runGitAsync(["config", "merge.ours.driver", "true"]);
    assert.equal(await reader.hasMergeDriversAsync(repository.folder), true);
  });

  test("merges two commits into a tree, naming each conflicting path once, and none for a clean merge", async () => {
    const conflicted = await reader.mergeAsync(repository.folder, [], ["HEAD", "side"]);
    const clean = await reader.mergeAsync(repository.folder, [], ["HEAD", "HEAD"]);

    assert.match(conflicted.tree, /^[0-9a-f]{40,64}$/v);
    assert.deepEqual(conflicted.paths, ["a.txt"]);
    assert.equal(clean.tree, (await repository.runGitAsync(["rev-parse", "HEAD^{tree}"])).trim());
    assert.deepEqual(clean.paths, []);
  });

  test("reads each revision's id in order", async () => {
    const ids = await reader.readIdsAsync(repository.folder, ["side", "HEAD"]);

    assert.deepEqual(ids, [(await repository.runGitAsync(["rev-parse", "side"])).trim(), (await repository.runGitAsync(["rev-parse", "HEAD"])).trim()]);
  });

  test("fails with git's errors, marked untrusted, when a command fails or its output is cut", async () => {
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const scripted = new MergeTreeReader(runner, new FilterOptionsReader(runner));

    runner.failing = ".driver$";
    runner.failingCode = 3;
    await assert.rejects(scripted.hasMergeDriversAsync(repository.folder), failed("config"));
    runner.failing = "--write-tree";
    runner.failingCode = 2;
    await assert.rejects(scripted.mergeAsync(repository.folder, [], ["HEAD", "side"]), failed("merge-tree"));
    runner.failing = null;
    runner.truncating = "rev-parse";
    await assert.rejects(scripted.readIdsAsync(repository.folder, ["HEAD"]), { name: "GitFailedException", code: FailureCode.Unavailable, command: "rev-parse" });
  });
});
