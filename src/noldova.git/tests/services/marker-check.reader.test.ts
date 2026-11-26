/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { MarkerCheckReader } from "../../src/services/marker-check.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("MarkerCheckReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.writeAsync("a.txt", "one\ntwo\nthree\n");
    await template.writeAsync("b.txt", "b\n");
    await template.runGitAsync(["add", "."]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Base"]);
    await template.runGitAsync(["switch", "--quiet", "--create", "side"]);
    await template.writeAsync("a.txt", "one\nside\nthree\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Change on side"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
    await template.writeAsync("a.txt", "one\nmain\nthree\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Change on main"]);
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new ProgramRunner(supervisor.context);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  test("finds each tracked file with a marker line once, staged or not, a file in conflict among them, and none in a clean folder", async () => {
    const reader = new MarkerCheckReader(runner);
    const clean = (await reader.readAsync(repository.folder)).paths;
    await repository.runGitAsync(["merge", "--quiet", "side"]).catch(() => "");
    await repository.writeAsync("b.txt", "b\n<<<<<<< main\nmine\n=======\nyours\n>>>>>>> side\n");
    await repository.writeAsync("é.txt", "<<<<<<< main\nnew\n>>>>>>> side\n");
    await repository.runGitAsync(["add", "b.txt", "é.txt"]);
    await repository.writeAsync("loose.txt", "<<<<<<< main\nuntracked\n");

    assert.deepEqual([clean, [...(await reader.readAsync(repository.folder)).paths].sort()], [[], ["a.txt", "b.txt", "é.txt"]]);
  });

  test("decodes the paths git quotes: octal bytes of UTF-8 text, a control character's escape, an escaped quote or backslash, and any other escaped letter as itself", async () => {
    const scripted = new ScriptedRunnerFixture(supervisor.context);
    scripted.answering = ["--check", [
      "\"\\303\\251.txt\":2: leftover conflict marker",
      "\"tab\\there.txt\":1: leftover conflict marker",
      "\"say \\\"hi\\\"\\\\.txt\":4: leftover conflict marker",
      "\"odd\\qname.txt\":5: leftover conflict marker",
      "plain:name.txt:9: leftover conflict marker",
      "plain:name.txt:12: leftover conflict marker",
      "a.txt:3: trailing whitespace."
    ].join("\n") + "\n"];

    assert.deepEqual((await new MarkerCheckReader(scripted).readAsync(repository.folder)).paths, ["é.txt", "tab\there.txt", "say \"hi\"\\.txt", "oddqname.txt", "plain:name.txt"]);
  });

  test("fails with git's errors as untrusted text when git can't run the check", async () => {
    const scripted = new ScriptedRunnerFixture(supervisor.context);
    scripted.failing = "--check";
    scripted.failingCode = 128;

    await assert.rejects(new MarkerCheckReader(scripted).readAsync(repository.folder), (error: unknown) =>
      error instanceof GitFailedException && error.output?.text === "scripted failure\n");
  });

  test("fails when git's answer was cut, as a marker past the cut would be missed", async () => {
    const scripted = new ScriptedRunnerFixture(supervisor.context);
    scripted.truncating = "--check";

    await assert.rejects(new MarkerCheckReader(scripted).readAsync(repository.folder), GitFailedException);
  });
});
