/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test, vi } from "vitest";

import { FailureCode, GitTag, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { Resources } from "../../src/resources.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryItemsReader } from "../../src/services/repository-items.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("RepositoryItemsReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let reader: RepositoryItemsReader;

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
    reader = new RepositoryItemsReader(new ProgramRunner(supervisor.context));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const headAsync = async (): Promise<string> => (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();

  test("reads nothing from a repository with no tags, stashes or submodules", async () => {
    assert.deepEqual((await reader.readAsync(repository.folder)).toJson(), { tags: [], stashes: [], submodules: [], truncated: false });
  });

  test("reads tags newest first, an annotated one by the commit it points at, stashes newest first, and the index's submodules by path", async () => {
    const first = await headAsync();
    await repository.runGitAsync(["tag", "v1"]);
    await repository.writeAsync("a.txt", "second\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Second", "--date=2030-01-01T00:00:00Z"]);
    const second = await headAsync();
    await repository.runGitAsync(["-c", "user.name=Tagger", "-c", "user.email=tagger@example.com", "tag", "-a", "v2", "-m", "Two"], "");
    await repository.writeAsync("a.txt", "stashed once\n");
    await repository.runGitAsync(["stash", "push", "--quiet", "-m", "older"]);
    await repository.writeAsync("a.txt", "stashed twice\n");
    await repository.runGitAsync(["stash", "push", "--quiet", "-m", "newer"]);
    const stashes = (await repository.runGitAsync(["log", "--walk-reflogs", "--format=%H", "refs/stash"])).trim().split("\n");
    await repository.runGitAsync(["update-index", "--add", "--cacheinfo", `160000,${first},vendor/lib`]);

    const items = await reader.readAsync(repository.folder);

    assert.deepEqual(items.tags.map(t => [t.name, t.id]).toSorted(), [["v1", first], ["v2", second]]);
    assert.deepEqual(items.stashes.map(t => [t.index, t.message.endsWith("newer") || t.message.endsWith("older") ? t.message.slice(-5) : t.message, t.id]),
      [[0, "newer", stashes[0]], [1, "older", stashes[1]]]);
    assert.deepEqual([items.submodules.map(t => [t.path, t.id]), items.truncated], [[["vendor/lib", first]], false]);
  });

  test("cuts each list at its limit and says so", async () => {
    await repository.runGitAsync(["tag", "a"]);
    await repository.runGitAsync(["tag", "b"]);
    const before = Resources.repositoryItemsLimit;
    Object.defineProperty(Resources, "repositoryItemsLimit", { value: 1, configurable: true, writable: true });
    try {
      const items = await reader.readAsync(repository.folder);

      assert.deepEqual([items.tags.length, items.truncated], [1, true]);
    } finally {
      Object.defineProperty(Resources, "repositoryItemsLimit", { value: before, configurable: true, writable: true });
    }
  });

  test("leaves out an entry the protocol refuses and says the list was cut, and counts a submodule list git cut", async () => {
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const scripted = new RepositoryItemsReader(runner);
    runner.answering = ["for-each-ref", `${"x".repeat(1_001)}\0\0${await headAsync()}\nv1\0\0${await headAsync()}\n`];

    const refused = await scripted.readAsync(repository.folder);
    runner.answering = null;
    runner.truncating = "ls-files";
    const cut = await scripted.readAsync(repository.folder);

    assert.deepEqual([refused.tags.map(t => t.name), refused.truncated], [["v1"], true]);
    assert.equal(cut.truncated, true);
  });

  test("passes a failure other than the protocol's on, and fails with git's errors marked untrusted", async () => {
    await repository.runGitAsync(["tag", "v1"]);
    const broken = new Error("broken");
    const spy = vi.spyOn(GitTag, "fromJson").mockImplementation(() => {
      throw broken;
    });
    await assert.rejects(reader.readAsync(repository.folder), broken);
    spy.mockRestore();
    const outside = path.join(repository.root, "outside");
    await mkdir(outside);
    const runner = new ScriptedRunnerFixture(supervisor.context);
    runner.failing = "ls-files";

    await assert.rejects(reader.readAsync(outside), (error: unknown) =>
      error instanceof GitFailedException && error.code === FailureCode.Unavailable && error.output?.source === UntrustedSource.Repository);
    await assert.rejects(new RepositoryItemsReader(runner).readAsync(repository.folder), (error: unknown) => error instanceof GitFailedException);
  });
});
