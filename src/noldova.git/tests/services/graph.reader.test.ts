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

import { FailureCode, RefKind, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { UnreadableOutputException } from "../../src/exceptions/unreadable-output.exception.ts";
import { GraphReader } from "../../src/services/graph.reader.ts";
import { LogReader } from "../../src/services/log.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("GraphReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let reader: GraphReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["switch", "--quiet", "--create", "side"]);
    await template.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Side", "--date=2030-01-01T00:00:00Z"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
    await template.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Main", "--date=2030-01-02T00:00:00Z"]);
    await template.runGitAsync(["tag", "v1"]);
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    reader = new GraphReader(new ProgramRunner(supervisor.context));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const record = (id: string, decorations: string): string => `${id}\0\0Sample Author\0author@example.com\x002026-11-20T14:02:00Z\x001795701720\0Subject\0${decorations}\0`;

  test("reads every branch's commits with their labels, a page at a time, and says when more follow", async () => {
    const graph = await reader.readAsync(repository.folder, 3, 0);
    const next = await reader.readAsync(repository.folder, 3, 2);

    assert.deepEqual(graph.commits.map(t => [t.commit.subject, t.refs.map(r => `${r.kind}:${r.name}`)]), [
      ["Main", [`${RefKind.Head}:main`, `${RefKind.Branch}:main`, `${RefKind.Tag}:v1`]],
      ["Side", [`${RefKind.Branch}:side`]],
      ["Start", []]
    ]);
    assert.deepEqual([graph.truncated, next.commits.map(t => t.commit.subject), next.truncated], [false, ["Start"], false]);
    assert.deepEqual([(await reader.readAsync(repository.folder, 2, 0)).truncated, graph.commits[0]?.email], [true, "test@example.invalid"]);
  });

  test("labels a detached HEAD, remote branches but not a remote's HEAD, and answers no commits before the first commit", async () => {
    const remote = path.join(repository.root, "remote.git");
    await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
    await repository.runGitAsync(["remote", "add", "origin", remote]);
    await repository.runGitAsync(["fetch", "--quiet", "origin"]);
    await repository.runGitAsync(["remote", "set-head", "origin", "main"]);
    await repository.runGitAsync(["switch", "--quiet", "--detach", "side"]);
    const empty = path.join(repository.root, "empty");
    await repository.runGitAsync(["init", "--quiet", empty]);

    const graph = await reader.readAsync(repository.folder, 10, 0);

    assert.deepEqual(graph.commits.slice(0, 2).map(t => t.refs.map(r => `${r.kind}:${r.name}`).toSorted()), [
      [`${RefKind.Branch}:main`, `${RefKind.RemoteBranch}:origin/main`, `${RefKind.Tag}:v1`],
      [`${RefKind.Branch}:side`, `${RefKind.Head}:`, `${RefKind.RemoteBranch}:origin/side`]
    ]);
    assert.deepEqual((await reader.readAsync(empty, 10, 0)).toJson(), { commits: [], truncated: false });
  });

  test("fails with git's errors marked untrusted outside a repository, and refuses cut or unreadable output", async () => {
    const outside = path.join(repository.root, "outside");
    await mkdir(outside);
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const scripted = new GraphReader(runner);

    await assert.rejects(reader.readAsync(outside, 10, 0), (error: unknown) =>
      error instanceof GitFailedException && error.code === FailureCode.Unavailable && error.output?.source === UntrustedSource.Repository);
    runner.failing = "log";
    runner.failingCode = 128;
    await assert.rejects(scripted.readAsync(repository.folder, 10, 0), (error: unknown) => error instanceof GitFailedException);
    runner.failing = null;
    runner.truncating = "log";
    await assert.rejects(scripted.readAsync(repository.folder, 10, 0), UnreadableOutputException);
    runner.truncating = null;
    runner.answering = ["log", "a\0b\0"];
    await assert.rejects(scripted.readAsync(repository.folder, 10, 0), UnreadableOutputException);
    runner.answering = ["log", `${record("a".repeat(40), "")}x`];
    await assert.rejects(scripted.readAsync(repository.folder, 10, 0), UnreadableOutputException);
    runner.answering = ["log", record("short", "")];
    await assert.rejects(scripted.readAsync(repository.folder, 10, 0), UnreadableOutputException);
  });

  test("keeps a HEAD pointer's name as git gives it when it isn't a full branch name", () => {
    assert.deepEqual(GraphReader.refsOf("HEAD -> main").map(r => `${r.kind}:${r.name}`), [`${RefKind.Head}:main`]);
  });

  test("passes a failure other than the protocol's on", async () => {
    const broken = new Error("broken");
    const spy = vi.spyOn(LogReader, "toLine").mockImplementation(() => {
      throw broken;
    });
    try {
      await assert.rejects(reader.readAsync(repository.folder, 10, 0), broken);
    } finally {
      spy.mockRestore();
    }
  });
});
