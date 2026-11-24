/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CommitDetailReader } from "../../src/services/commit-detail.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("CommitDetailReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let reader: CommitDetailReader;

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
    reader = new CommitDetailReader(new ProgramRunner(supervisor.context));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  test("reads a commit's body after its subject, with its lines, and its committer apart from its author", async () => {
    await repository.writeAsync("a.txt", "second\n");
    await repository.runGitAsync(["-c", "user.name=Committer One", "-c", "user.email=one@example.com", "commit", "--quiet", "-a",
      "--author=Author Two <two@example.com>", "-m", "Subject line", "-m", "First paragraph.\nSecond line.", "-m", "Last paragraph."]);
    const id = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();

    const detail = await reader.readAsync(repository.folder, id);

    assert.deepEqual([detail.id, detail.body, detail.committer, detail.committerEmail, detail.truncated],
      [id, "First paragraph.\nSecond line.\n\nLast paragraph.", "Committer One", "one@example.com", false]);
    assert.match(detail.committedAt, /^\d{4}-\d{2}-\d{2}T/u);
  });

  test("says when the body was cut at its limit, and fails with git's errors marked untrusted for a commit it can't find", async () => {
    const id = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
    const runner = new ScriptedRunnerFixture(supervisor.context);
    runner.truncating = "log";

    const cut = await new CommitDetailReader(runner).readAsync(repository.folder, id);

    assert.equal(cut.truncated, true);
    await assert.rejects(reader.readAsync(repository.folder, "f".repeat(id.length)), (error: unknown) =>
      error instanceof GitFailedException && error.output?.source === UntrustedSource.Repository);
  });
});
