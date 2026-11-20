/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test, vi } from "vitest";

import { CleanUps } from "./clean-ups.fixture.ts";
import { RepositoryFixture } from "./repository.fixture.ts";

describe("RepositoryFixture", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const isRefusedByTheFake = (error: unknown): boolean =>
    error instanceof Error && "stderr" in error && String(error.stderr).includes("fake prompt refuses to answer");

  test("a git call that needs an editor fails at once through the fake prompt", async () => {
    await assert.rejects(repository.runGitAsync(["commit", "--allow-empty"]), isRefusedByTheFake);
  });

  test("a git call that needs a credential fails at once through the fake prompt", async () => {
    await assert.rejects(repository.runGitAsync(["credential", "fill"], "protocol=https\nhost=example.invalid\n\n"), isRefusedByTheFake);
  });

  test("a copy holds the template's commit, and its changes stay its own", async () => {
    await repository.writeAsync("b.txt", "b\n");

    assert.equal(await repository.runGitAsync(["log", "--format=%s"]), "Start\n");
    assert.equal(await repository.runGitAsync(["status", "--porcelain"]), "?? b.txt\n");
    assert.equal(await template.runGitAsync(["status", "--porcelain"]), "");
  });

  test("its git runs no automatic maintenance, whose lock a copy of the repository would race", async () => {
    assert.equal(await repository.runGitAsync(["config", "--get", "maintenance.auto"]), "false\n");
  });

  test("a fixture that fails while it is made leaves no folder behind", async () => {
    const gone = await RepositoryFixture.createAsync();
    await gone.disposeAsync();
    const temporary = await mkdtemp(path.join(tmpdir(), "noldova-git-fixture-"));
    cleanUps.add(() => rm(temporary, { recursive: true, force: true }));
    for (const name of ["TMPDIR", "TEMP", "TMP"])
      vi.stubEnv(name, temporary);
    cleanUps.add(() => {
      vi.unstubAllEnvs();
    });

    await assert.rejects(RepositoryFixture.createAsync(gone), { code: "ENOENT" });

    assert.deepEqual(await readdir(temporary), []);
  });

  test("a git call that exits before it reads its input still gives its output", async () => {
    const output = await repository.runGitAsync(["--version"], "x".repeat(4 * 1024 * 1024));

    assert.match(output, /^git version /v);
  });
});
