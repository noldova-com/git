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

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { IgnoredPaths } from "../../src/services/ignored-paths.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("IgnoredPaths", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let runner: ScriptedRunnerFixture;
  let ignored: IgnoredPaths;
  let checks: string[];

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    const supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new ScriptedRunnerFixture(supervisor.context);
    checks = [];
    runner.starting = command => {
      if (command.includes("check-ignore"))
        checks.push(command);
    };
    ignored = new IgnoredPaths(runner);
    await repository.writeAsync(".gitignore", "bin/\n*.log\n");
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  test("finds a shown file among ignored ones, with either separator, and none among ignored files, folders named with or without a slash and the git folder's files", async () => {
    await mkdir(path.join(repository.folder, "bin"));
    const answers = [
      await ignored.hasShownAsync(repository.folder, ["bin/out.dll", "src\\app.ts"]),
      await ignored.hasShownAsync(repository.folder, ["bin/obj/out.dll", "debug.log", "src/run.log", "bin"]),
      await ignored.hasShownAsync(repository.folder, [".git", ".git/index", ".git\\refs\\heads\\main", ""])
    ];

    assert.deepEqual(answers, [true, false, false]);
  });

  test("remembers an ignored folder, so a later change under it costs no check, but asks about each file again, as a rule can pick out one file", async () => {
    await ignored.hasShownAsync(repository.folder, ["bin/out.dll"]);
    const afterFirst = checks.length;
    const underIgnored = await ignored.hasShownAsync(repository.folder, ["bin/deep/more.dll", "bin/other.dll"]);
    const afterUnder = checks.length;
    const files = [await ignored.hasShownAsync(repository.folder, ["src/a.log"]), await ignored.hasShownAsync(repository.folder, ["src/a.ts"])];

    assert.deepEqual([afterFirst, underIgnored, afterUnder, files, checks.length], [1, false, 1, [false, true], 3]);
  });

  test("counts a changed ignore file as a change and forgets every folder's answer, so a folder a new rule ignores is ignored", async () => {
    const before = await ignored.hasShownAsync(repository.folder, ["out/a.dll"]);
    await repository.writeAsync(".gitignore", "bin/\n*.log\nout/\n");
    const changed = [await ignored.hasShownAsync(repository.folder, [".gitignore"]), await ignored.hasShownAsync(repository.folder, ["docs\\.gitignore"])];
    const after = await ignored.hasShownAsync(repository.folder, ["out/a.dll"]);

    assert.deepEqual([before, changed, after], [true, [true, true], false]);
  });

  test("shows a tracked file even where a rule would ignore it, as git's status does", async () => {
    await repository.writeAsync("kept.log", "kept\n");
    await repository.runGitAsync(["add", "--force", "kept.log"]);

    assert.equal(await ignored.hasShownAsync(repository.folder, ["kept.log"]), true);
  });

  test("throws git's failure, and a cut-short answer, as a failed check", async () => {
    runner.failing = "check-ignore";
    runner.failingCode = 128;
    await assert.rejects(ignored.hasShownAsync(repository.folder, ["a.ts"]), (error: unknown) => error instanceof GitFailedException);
    runner.failing = null;
    runner.truncating = "check-ignore";

    await assert.rejects(ignored.hasShownAsync(repository.folder, ["b.log"]), (error: unknown) => error instanceof GitFailedException);
  });

  test("starts over once it would remember too many folders, so a folder it knew is asked about again", async () => {
    await ignored.hasShownAsync(repository.folder, ["bin/out.dll"]);
    const many = await ignored.hasShownAsync(repository.folder, Array.from({ length: 5_001 }, (_, i) => `f${i}/a.ts`));
    const asked = checks.length;
    const again = await ignored.hasShownAsync(repository.folder, ["bin/again.dll"]);

    assert.deepEqual([many, asked, again, checks.length], [true, 2, false, 3]);
  });

  test("tells which folders git ignores, asking once for each, and starts over once it would remember too many", async () => {
    const first = await ignored.ignoredFoldersAsync(repository.folder, ["bin", "src", "bin"]);
    const known = await ignored.ignoredFoldersAsync(repository.folder, ["bin"]);
    const asked = checks.length;
    await ignored.ignoredFoldersAsync(repository.folder, Array.from({ length: 10_001 }, (_, i) => `g${i}`));
    const again = await ignored.ignoredFoldersAsync(repository.folder, ["bin"]);

    assert.deepEqual([[...first], [...known], asked, [...again], checks.length], [["bin"], ["bin"], 1, ["bin"], 3]);
  });
});
