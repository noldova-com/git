/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { FailureCode as DesktopCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { FailureCode } from "@noldova/git.protocol";

import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { KeyQueue } from "../../src/services/key-queue.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RemoteReader } from "../../src/services/remote.reader.ts";
import { RepositoryStatuses } from "../../src/services/repository-statuses.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("RepositoryStatuses", () => {
  const signal = new AbortController().signal;
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let statuses: RepositoryStatuses;

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
    const runner = new ProgramRunner(supervisor.context);
    statuses = new RepositoryStatuses(new RepositoryReader(runner, new GitVersionReader(runner)), new StatusReader(runner), new RemoteReader(runner), new KeyQueue());
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const failure = (code: DesktopCode, gitCode: FailureCode): ((error: unknown) => boolean) => (error: unknown): boolean => {
    assert.ok(error instanceof MethodFailureException);
    assert.equal(error.failure.code, code);
    assert.equal(error.failure.details?.["code"], gitCode);
    return true;
  };

  test("reads a repository's status, and fails a folder that isn't absolute or isn't in a repository as git.status does", async () => {
    await repository.writeAsync("a.txt", "changed\n");

    const status = await statuses.readStatusAsync(repository.folder, signal);

    assert.deepEqual([status.branch, status.entries.map(t => t.path)], ["main", ["a.txt"]]);
    await assert.rejects(statuses.readStatusAsync("relative", signal), failure(DesktopCode.InvalidParams, FailureCode.Refused));
    await assert.rejects(statuses.readStatusAsync(repository.home, signal), failure(DesktopCode.NotFound, FailureCode.NotRepository));
  });

  test("reads a remote by its name, whatever remote the branch works with", async () => {
    await repository.runGitAsync(["remote", "add", "origin", "https://host.example/team/repo.git"]);
    await repository.runGitAsync(["remote", "add", "upstream", "https://host.example/upstream-team/repo.git"]);

    const untracked = [(await statuses.readStatusAsync(repository.folder, signal)).remote, await statuses.readRemoteAsync(repository.folder, "origin", signal)];
    await repository.runGitAsync(["config", "branch.main.remote", "upstream"]);
    const tracking = [(await statuses.readStatusAsync(repository.folder, signal)).remote, await statuses.readRemoteAsync(repository.folder, "origin", signal)];

    assert.deepEqual([...untracked, ...tracking].map(t => t?.path ?? null), [null, "team/repo", "upstream-team/repo", "team/repo"]);
    assert.equal(await statuses.readRemoteAsync(repository.folder, "fork", signal), null);
    await assert.rejects(statuses.readRemoteAsync("relative", "origin", signal), failure(DesktopCode.InvalidParams, FailureCode.Refused));
    await assert.rejects(statuses.readRemoteAsync(repository.home, "origin", signal), failure(DesktopCode.NotFound, FailureCode.NotRepository));
  });

  test("reads a remote's user name by the remote's name, and fails a folder that isn't absolute or isn't in a repository as git.status does", async () => {
    await repository.runGitAsync(["remote", "add", "origin", "https://kim@host.example/team/repo.git"]);
    await repository.runGitAsync(["remote", "add", "upstream", "https://host.example/upstream-team/repo.git"]);

    assert.deepEqual([await statuses.readRemoteUserAsync(repository.folder, "origin", signal), await statuses.readRemoteUserAsync(repository.folder, "upstream", signal)],
      ["kim", null]);
    await assert.rejects(statuses.readRemoteUserAsync("relative", "origin", signal), failure(DesktopCode.InvalidParams, FailureCode.Refused));
    await assert.rejects(statuses.readRemoteUserAsync(repository.home, "origin", signal), failure(DesktopCode.NotFound, FailureCode.NotRepository));
  });
});
