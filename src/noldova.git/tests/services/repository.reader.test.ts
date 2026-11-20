/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { chmod, mkdir, realpath } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, onTestFinished, test, vi } from "vitest";

import { FailureCode, GitCode, UntrustedSource } from "@noldova/git.protocol";

import { FolderUnreadableException } from "../../src/exceptions/folder-unreadable.exception.ts";
import { UnsafeRepositoryException } from "../../src/exceptions/unsafe-repository.exception.ts";
import { FilePresence } from "../../src/services/file-presence.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("RepositoryReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let reader: RepositoryReader;

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
    cleanUps.add(() => {
      vi.restoreAllMocks();
    });
    const runner = new ProgramRunner(supervisor.context);
    reader = new RepositoryReader(runner, new GitVersionReader(runner));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  test("reads the top folder, the git folder and the common git folder of the main worktree and a linked one", async () => {
    const worktree = path.join(repository.root, "linked");
    await repository.runGitAsync(["worktree", "add", "--quiet", "--detach", worktree]);

    const main = await reader.readAsync(repository.folder);
    const linked = await reader.readAsync(worktree);

    assert.equal(main.top, path.resolve(repository.folder));
    assert.equal(main.gitFolder, path.resolve(repository.gitFolder));
    assert.equal(main.commonGitFolder, path.resolve(repository.gitFolder));
    assert.equal(linked.top, path.resolve(await realpath(worktree)));
    assert.equal(linked.gitFolder, path.resolve(repository.gitFolder, "worktrees", "linked"));
    assert.equal(linked.commonGitFolder, path.resolve(repository.gitFolder));
    await repository.runGitAsync(["worktree", "remove", "--force", worktree]);
  });

  test("refuses a repository git calls unsafe, since another user owns it, naming the folder, and never trusts it itself", async () => {
    const foreign = await DesktopFixture.createAsync(repository.supervisorEnvironment(), { GIT_TEST_ASSUME_DIFFERENT_OWNER: "1" });
    onTestFinished(() => foreign.disposeAsync());
    const runner = new ProgramRunner(foreign.context);

    await assert.rejects(new RepositoryReader(runner, new GitVersionReader(runner)).readAsync(repository.folder), (error: unknown): boolean => {
      assert.ok(error instanceof UnsafeRepositoryException);
      assert.deepEqual([error.code, error.gitCode, error.folder, error.output?.source], [FailureCode.NotRepository, GitCode.UnsafeRepository, repository.folder, UntrustedSource.Repository]);
      assert.match(error.output?.text ?? "", /detected dubious ownership/v);
      return true;
    });
    assert.equal(foreign.requests.some(t => t.arguments.includes("safe.directory")), false);
  });

  test("refuses a relative folder before it starts git", async () => {
    await assert.rejects(reader.readAsync("repository"), {
      name: "RepositoryNotAbsoluteException",
      code: FailureCode.Refused,
      gitCode: null,
      message: "The repository must be an absolute path."
    });
  });

  test("refuses a missing folder and a folder outside any repository as NotRepository", async () => {
    const refusal = { name: "NotARepositoryException", code: FailureCode.NotRepository, gitCode: null };

    await assert.rejects(reader.readAsync(path.join(repository.root, "missing")), refusal);
    await assert.rejects(reader.readAsync(repository.home), refusal);
  });

  test("answers a folder the account may not read as FolderUnreadable, before it starts git", async context => {
    context.skip(process.platform === "win32", "Windows has no permission bits that deny the account a folder; Node reads only the read-only attribute there.");
    const folder = path.join(repository.folder, "locked");
    await mkdir(folder);
    await chmod(folder, 0o000);
    let refusal: unknown;
    try {
      await reader.readAsync(folder);
    } catch (error) {
      refusal = error;
    } finally {
      await chmod(folder, 0o755);
    }

    assert.ok(refusal instanceof FolderUnreadableException);
    assert.deepEqual([refusal.code, refusal.gitCode, refusal.folder, refusal.cause instanceof Error && "code" in refusal.cause ? refusal.cause.code : null],
      [FailureCode.Unavailable, GitCode.FolderUnreadable, folder, "EACCES"]);
    assert.deepEqual(supervisor.requests, []);
  });

  test("answers a folder the account may not read as FolderUnreadable on Windows too, by the file system's denial stood in, since Windows can't deny a folder", async context => {
    context.skip(process.platform !== "win32", "Elsewhere the test above denies a real folder.");
    const denied = Object.assign(new Error("permission denied"), { code: "EPERM", syscall: "access" });
    vi.spyOn(FilePresence, "existsAsync").mockRejectedValue(denied);

    await assert.rejects(reader.readAsync(repository.folder), { name: "FolderUnreadableException", code: FailureCode.Unavailable, gitCode: GitCode.FolderUnreadable, cause: denied });
    assert.deepEqual(supervisor.requests, []);
  });

  test("fails on a folder it can't check for a reason other than its absence, rather than calling it no repository", async () => {
    await assert.rejects(reader.readAsync(path.join(repository.root, `bad${String.fromCharCode(0)}name`)), { code: "ERR_INVALID_ARG_VALUE" });
  });

  test("checks git's version before it reads a folder, so an old git fails as too old rather than as no repository", async () => {
    const runner = new ScriptedRunnerFixture(supervisor.context);
    runner.answering = ["version", "git version 2.20.0\n"];

    await assert.rejects(new RepositoryReader(runner, new GitVersionReader(runner)).readAsync(repository.folder), {
      name: "GitTooOldException",
      code: FailureCode.Git,
      gitCode: GitCode.GitTooOld
    });
  });
});
