/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { FailureCode, GitCode, UntrustedSource } from "@noldova/git.protocol";

import { GitTooOldException } from "../../src/exceptions/git-too-old.exception.ts";
import { GitVersion } from "../../src/models/git-version.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("GitVersionReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ScriptedRunnerFixture;

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
    runner = new ScriptedRunnerFixture(supervisor.context);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  test("accepts git 2.39 and later, and refuses an older or unreadable version, naming the version as the protocol carries it", async () => {
    const cases = [
      ["git version 2.39.0", undefined],
      ["git version 2.47.1.windows.2\n", undefined],
      ["git version 3.0", undefined],
      ["git version 2.38.5", "2.38.5"],
      ["git version 1.99.0", "1.99.0"],
      ["git version 2.34.1\n", "2.34.1"],
      ["git version 2.30.1 (Apple Git-130)", "2.30.1"],
      ["git version 2.30.1.a.b.c.d", null],
      ["git version 2.30-rc1", null],
      ["version 2.40", null]
    ] as const;
    const answers: (string | null | undefined)[] = [];

    for (const [output] of cases) {
      runner.answering = ["version", output];
      answers.push(await new GitVersionReader(runner).requireAsync(repository.folder).then(() => undefined, (error: unknown) => {
        assert.ok(error instanceof GitTooOldException);
        return error.gitVersion;
      }));
    }

    assert.deepEqual(answers, cases.map(([, version]) => version));
  });

  test("says whether git is at least a given version, reading it once for every question", async () => {
    const commands: string[] = [];
    runner.starting = command => commands.push(command);
    runner.answering = ["version", "git version 2.40.1\n"];
    const reader = new GitVersionReader(runner);

    assert.deepEqual([
      await reader.atLeastAsync(repository.folder, new GitVersion(2, 40)),
      await reader.atLeastAsync(repository.folder, new GitVersion(2, 41)),
      await reader.atLeastAsync(repository.folder, new GitVersion(3, 0)),
      await reader.atLeastAsync(repository.folder, new GitVersion(1, 99))
    ], [true, false, false, true]);
    await reader.requireAsync(repository.folder);
    assert.deepEqual(commands, ["version"]);
  });

  test("runs the real git, which is new enough", async () => {
    await new GitVersionReader(new ProgramRunner(supervisor.context)).requireAsync(repository.folder);

    assert.deepEqual(supervisor.requests.map(t => t.arguments.at(-1)), ["version"]);
  });

  test("fails with the version of a git that is too old", async () => {
    runner.answering = ["version", "git version 2.34.1\n"];

    await assert.rejects(new GitVersionReader(runner).requireAsync(repository.folder), {
      name: "GitTooOldException",
      code: FailureCode.Git,
      gitCode: GitCode.GitTooOld,
      gitVersion: "2.34.1"
    });
  });

  test("fails with git's output when git version fails, and runs it once while it passes, and again after it failed", async () => {
    const reader = new GitVersionReader(runner);
    const commands: string[] = [];
    runner.starting = command => commands.push(command);
    runner.failing = "version";

    await assert.rejects(reader.requireAsync(repository.folder), {
      name: "GitFailedException",
      code: FailureCode.Unavailable,
      gitCode: null,
      command: "version",
      message: "git version failed; its output comes with the failure as untrusted text.",
      output: { text: "scripted failure\n", source: UntrustedSource.Repository }
    });
    runner.failing = null;
    await reader.requireAsync(repository.folder);
    await reader.requireAsync(repository.folder);

    assert.deepEqual(commands, ["version", "version"]);
  });
});
