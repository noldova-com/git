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

import { FailureCode, GitMessageReference, GitMessageReferences, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { UnreadableOutputException } from "../../src/exceptions/unreadable-output.exception.ts";
import { MessageReferenceReader } from "../../src/services/message-reference.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("MessageReferenceReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let reader: MessageReferenceReader;

  const commitAsync = async (target: RepositoryFixture, ...messages: string[]): Promise<void> => {
    await target.runGitAsync(["commit", "--quiet", "--allow-empty", ...messages.flatMap(t => ["-m", t])]);
  };

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await commitAsync(template, "Read local times", "Closes AB#4702 and AB#4831, then AB#4702 again.");
    await template.runGitAsync(["switch", "--quiet", "--create", "side"]);
    await commitAsync(template, "Fold tag case AB#4832", "See https://dev.azure.com/fabrikam/_workitems/AB#9, src/AB#7, xAB#6, AB#5a, AB#0 and AB#12345678901.");
    await commitAsync(template, "Rename src/AB#7 to lib/AB#7", "Only xAB#6 and AB#5a, which name nothing.");
    await commitAsync(template, "Tidy imports");
    await template.runGitAsync(["switch", "--quiet", "main"]);
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    reader = new MessageReferenceReader(new ProgramRunner(supervisor.context));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  test("answers every branch's commits whose whole messages name AB#N on its own, in the graph's order, each number once, none for a message with AB#N only inside longer tokens, and says when older ones went unread", async () => {
    const [side, main] = [(await repository.runGitAsync(["rev-parse", "side~2"])).trim(), (await repository.runGitAsync(["rev-parse", "main"])).trim()];

    assert.deepEqual(await reader.readAsync(repository.folder, 10),
      new GitMessageReferences([new GitMessageReference(side, [4832]), new GitMessageReference(main, [4702, 4831])], false));
    assert.deepEqual(await reader.readAsync(repository.folder, 3), new GitMessageReferences([new GitMessageReference(side, [4832])], true));
    assert.deepEqual(await reader.readAsync(repository.folder, 2), new GitMessageReferences([], true));
  });

  test("answers no commits for an empty repository and for an unborn HEAD beside other branches", async () => {
    const empty = path.join(repository.root, "empty");
    await repository.runGitAsync(["init", "--quiet", empty]);
    await repository.runGitAsync(["switch", "--quiet", "--orphan", "fresh"]);

    assert.deepEqual([await reader.readAsync(empty, 10), await reader.readAsync(repository.folder, 10)], [new GitMessageReferences([], false), new GitMessageReferences([], false)]);
  });

  test("keeps a message's text out of a failure, marking git's errors untrusted, outside a repository and when either read fails", async () => {
    const outside = path.join(repository.root, "outside");
    await mkdir(outside);
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const scripted = new MessageReferenceReader(runner);
    const isFailure = (error: unknown): boolean => error instanceof GitFailedException && error.code === FailureCode.Unavailable && error.command === "log"
      && error.output?.source === UntrustedSource.Repository && !error.output.text.includes("AB#");

    await assert.rejects(reader.readAsync(outside, 10), isFailure);
    runner.failing = "--date-order";
    runner.failingCode = 128;
    await assert.rejects(scripted.readAsync(repository.folder, 10), isFailure);
    runner.failing = "--stdin";
    await assert.rejects(scripted.readAsync(repository.folder, 10), isFailure);
  });

  test("refuses cut or unreadable output, and reads no messages when git lists no commits", async () => {
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const scripted = new MessageReferenceReader(runner);
    const started: string[] = [];
    runner.starting = command => started.push(command);

    runner.truncating = "--date-order";
    await assert.rejects(scripted.readAsync(repository.folder, 10), UnreadableOutputException);
    runner.truncating = "--stdin";
    await assert.rejects(scripted.readAsync(repository.folder, 10), UnreadableOutputException);
    runner.truncating = null;
    for (const output of ["a\0", `${"a".repeat(40)}\0AB#1\0x`, "short\0AB#1\0"]) {
      runner.answering = ["--stdin", output];
      await assert.rejects(scripted.readAsync(repository.folder, 10), UnreadableOutputException);
    }
    runner.answering = ["--date-order", "\n"];
    started.length = 0;
    assert.deepEqual([await scripted.readAsync(repository.folder, 10), started.length], [new GitMessageReferences([], false), 1]);
  });

  test("matches AB#N only where it stands on its own, with no leading zero and at most ten digits", () => {
    assert.deepEqual(MessageReferenceReader.numbersOf("AB#1 (AB#2) AB#3. [AB#4] AB#5, AB#9999999999 #6 ab#7 AB#08 pathAB#9 a/AB#10 &AB#11 -AB#12 AB#13_ AB#14-x"),
      [1, 2, 3, 4, 5, 9_999_999_999]);
  });
});
