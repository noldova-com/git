/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { chmod, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { FailureCode } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { RefSnapshotReader } from "../../src/services/ref-snapshot.reader.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("RefSnapshotReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ScriptedRunnerFixture;
  let folders: RepositoryFolders;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["tag", "v1"]);
    await template.runGitAsync(["branch", "side"]);
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
    folders = await new RepositoryReader(runner, new GitVersionReader(runner)).readAsync(repository.folder);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const idOf = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();

  test("reads the checked-out branch, HEAD's commit, each local branch and tag, and with the index asked for, its tree", async () => {
    const head = await idOf("HEAD");
    const tag = await idOf("refs/tags/v1");

    const snapshot = await new RefSnapshotReader(runner).readAsync(folders, true);

    assert.deepEqual([snapshot.branch, snapshot.head, snapshot.index], ["main", head, (await repository.runGitAsync(["write-tree"])).trim()]);
    assert.deepEqual([...snapshot.refs], [["refs/heads/main", head], ["refs/heads/side", head], ["refs/tags/v1", tag]]);
    assert.equal(snapshot.valueOf("HEAD"), head);
    assert.equal(snapshot.valueOf("refs/heads/gone"), null);
    assert.equal((await new RefSnapshotReader(runner).readAsync(folders, false)).index, null);
  });

  test("reads a detached HEAD as no branch, an unborn branch as no commit, and an index with a conflict as no tree", async () => {
    await repository.runGitAsync(["switch", "--quiet", "--detach"]);
    const detached = await new RefSnapshotReader(runner).readAsync(folders, false);
    assert.deepEqual([detached.branch, detached.head], [null, await idOf("HEAD")]);

    await repository.runGitAsync(["switch", "--quiet", "--orphan", "fresh"]);
    const unborn = await new RefSnapshotReader(runner).readAsync(folders, false);
    assert.deepEqual([unborn.branch, unborn.head], ["fresh", null]);

    await repository.runGitAsync(["switch", "--quiet", "--force", "main"]);
    await repository.writeAsync("a.txt", "main\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Main"]);
    await repository.runGitAsync(["switch", "--quiet", "side"]);
    await repository.writeAsync("a.txt", "side\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Side"]);
    await repository.runGitAsync(["merge", "--quiet", "main"]).catch(() => undefined);
    assert.equal((await new RefSnapshotReader(runner).readAsync(folders, true)).index, null);
  });

  test("reads the index's tree without running the repository's post-index-change hook, though the read writes the index", async () => {
    await repository.writeAsync("c.txt", "c\n");
    await repository.runGitAsync(["update-index", "--add", "c.txt"]);
    const hook = path.join(repository.gitFolder, "hooks", "post-index-change");
    await writeFile(hook, "#!/bin/sh\ntouch \"$(git rev-parse --git-dir)/hook-ran\"\n");
    await chmod(hook, 0o755);

    const snapshot = await new RefSnapshotReader(runner).readAsync(folders, true);

    assert.ok(!(await readdir(repository.gitFolder)).includes("hook-ran"));
    assert.equal(snapshot.index, (await repository.runGitAsync(["write-tree"])).trim());
  });

  test("passes on a failure to list the refs, or to read HEAD or its branch, as git's own failure", async () => {
    for (const failing of ["for-each-ref", "symbolic-ref", "rev-parse --verify --quiet HEAD"]) {
      runner.failing = failing;
      runner.failingCode = 128;
      await assert.rejects(new RefSnapshotReader(runner).readAsync(folders, false), (error: unknown) => error instanceof GitFailedException && error.code === FailureCode.Unavailable);
    }
  });
});
