/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { chmod, rm } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, onTestFinished, test, vi } from "vitest";

import { FailureCode, GitCode, ProtocolFieldException, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { UnreadableOutputException } from "../../src/exceptions/unreadable-output.exception.ts";
import { LogReader } from "../../src/services/log.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("LogReader", () => {
  const unreadable = { name: "UnreadableOutputException", code: FailureCode.Git, gitCode: GitCode.UnreadableOutput, message: "git log printed commits that the module can't read." };
  const NUL = String.fromCharCode(0);
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let reader: LogReader;

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
    reader = new LogReader(new ProgramRunner(supervisor.context));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  test("reads HEAD's newest commits with their parents, author's name, time and subject, never the email, and whether more were left out", async () => {
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "--author=Sample Author <author@example.com>", "--date=2026-11-06T09:30:00-08:00",
      "-m", "Read the log", "-m", "The body stays out."]);
    const [second, first] = (await repository.runGitAsync(["rev-list", "HEAD"])).trim().split(/\r?\n/v);

    const log = await reader.readAsync(repository.folder, 5);
    assert.equal(log.truncated, false);
    assert.deepEqual(log.commits.map(t => [t.id, t.parents]), [[second, [first]], [first, []]]);
    assert.deepEqual(log.commits[0]?.toJson(), { id: second, parents: [first], author: "Sample Author", authoredAt: "2026-11-06T09:30:00-08:00", subject: "Read the log" });

    const newest = await reader.readAsync(repository.folder, 1);
    assert.deepEqual([newest.commits.map(t => t.id), newest.truncated], [[second], true]);
  });

  test("lists a merge's parents in git's order", async () => {
    await repository.runGitAsync(["checkout", "--quiet", "-b", "side"]);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Side"]);
    await repository.runGitAsync(["checkout", "--quiet", "main"]);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Main"]);
    await repository.runGitAsync(["merge", "--quiet", "--no-ff", "--no-edit", "side"]);
    const parents = (await repository.runGitAsync(["rev-parse", "HEAD^1", "HEAD^2"])).trim().split(/\r?\n/v);

    assert.deepEqual((await reader.readAsync(repository.folder, 1)).commits[0]?.parents, parents);
  });

  test("answers no commits before the first commit", async () => {
    const empty = path.join(repository.root, "empty");
    await repository.runGitAsync(["init", "--quiet", empty]);

    assert.deepEqual((await reader.readAsync(empty, 10)).toJson(), { commits: [], truncated: false });
  });

  test("fails with git's errors marked untrusted when git log fails on a repository with commits, and on output cut at its limit", async () => {
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const failing = new LogReader(runner);
    runner.truncating = "log";
    await assert.rejects(failing.readAsync(repository.folder, 10), unreadable);

    const first = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Second"]);
    const object = path.join(repository.gitFolder, "objects", first.slice(0, 2), first.slice(2));
    await chmod(object, 0o644);
    await rm(object);
    await assert.rejects(reader.readAsync(repository.folder, 10), (error: unknown) => {
      assert.ok(error instanceof GitFailedException);
      assert.deepEqual([error.code, error.message, error.output?.source], [FailureCode.Unavailable, "git log failed; its output comes with the failure as untrusted text.",
        UntrustedSource.Repository]);
      assert.match(error.output?.text ?? "", new RegExp(first, "v"));
      return true;
    });
  });

  test("refuses a cut record or a value the protocol refuses", async () => {
    const id = "a".repeat(40);
    const record = (fields: readonly string[]): string => fields.map(t => t + NUL).join("");
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const scripted = new LogReader(runner);
    const readAsync = (output: string): Promise<unknown> => {
      runner.answering = ["log", output];
      return scripted.readAsync(repository.folder, 10);
    };

    await assert.rejects(readAsync(record([id, "", "Sample Author", "2026-11-06T17:30:00Z"])), unreadable);
    await assert.rejects(readAsync(record([id, "", "Sample Author", "2026-11-06T17:30:00Z", "First"]).slice(0, -1)), unreadable);
    await assert.rejects(readAsync(record([id, "", "Sample Author", "yesterday", "First"])), (error: unknown): boolean => {
      assert.ok(error instanceof UnreadableOutputException);
      assert.equal(error.gitCode, GitCode.UnreadableOutput);
      assert.ok(error.cause instanceof ProtocolFieldException);
      assert.equal(error.cause.field, "authoredAt");
      return true;
    });
  });

  test("lets through a failure of its own reading that isn't a value the protocol refuses", async () => {
    const failure = new RangeError("The line broke.");
    const toLine = vi.spyOn(LogReader, "toLine").mockImplementationOnce(() => {
      throw failure;
    });
    onTestFinished(() => toLine.mockRestore());

    await assert.rejects(reader.readAsync(repository.folder, 10), failure);
  });

  test("replaces each control character in a name or subject and cuts it to 1000 characters without splitting a character", () => {
    const replacement = String.fromCodePoint(0xfffd);
    const face = String.fromCodePoint(0x1f600);

    assert.equal(LogReader.toLine("a" + String.fromCharCode(0x1b) + "[2J" + String.fromCharCode(0x85)), "a" + replacement + "[2J" + replacement);
    assert.equal(LogReader.toLine("a".repeat(1000)), "a".repeat(1000));
    assert.equal(LogReader.toLine("a".repeat(1001)), "a".repeat(1000));
    assert.equal(LogReader.toLine("a".repeat(999) + face), "a".repeat(999));
    assert.equal(LogReader.toLine("a".repeat(999) + String.fromCharCode(7) + "b"), "a".repeat(999) + replacement);
  });

  test("replaces each control character in a file name, keeping its whole length", () => {
    const replacement = String.fromCodePoint(0xfffd);

    assert.equal(LogReader.withoutControls("a" + String.fromCharCode(10) + "b" + "c".repeat(2000)), "a" + replacement + "b" + "c".repeat(2000));
  });
});
