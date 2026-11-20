/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { FailureCode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { BranchesReader } from "../../src/services/branches.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("BranchesReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let reader: BranchesReader;

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
    reader = new BranchesReader(new ProgramRunner(supervisor.context));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  test("reads the local branches in git's order, the one checked out, the remotes and their branches without each remote's HEAD", async () => {
    await repository.runGitAsync(["branch", "feature/login"]);
    await repository.runGitAsync(["branch", "Zeta"]);
    await repository.runGitAsync(["remote", "add", "upstream", "https://host/a/b"]);
    await repository.runGitAsync(["remote", "add", "origin", "https://host/c/d"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/main", "HEAD"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/upstream/feature/login", "HEAD"]);
    await repository.runGitAsync(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);

    assert.deepEqual((await reader.readAsync(repository.folder)).toJson(), {
      current: "main",
      branches: ["Zeta", "feature/login", "main"],
      remotes: ["origin", "upstream"],
      remoteBranches: ["origin/main", "upstream/feature/login"]
    });
  });

  test("names no branch checked out on a detached HEAD, and the unborn branch before the first commit", async () => {
    await repository.runGitAsync(["checkout", "--quiet", "--detach"]);
    assert.equal((await reader.readAsync(repository.folder)).current, null);

    const empty = path.join(repository.root, "empty");
    await repository.runGitAsync(["init", "--quiet", "--initial-branch=start", empty]);
    assert.deepEqual((await reader.readAsync(empty)).toJson(), { current: "start", branches: [], remotes: [], remoteBranches: [] });
  });

  test("names no branch checked out when HEAD names a ref outside the local branches", async () => {
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/main", "HEAD"]);
    await repository.runGitAsync(["symbolic-ref", "HEAD", "refs/remotes/origin/main"]);

    assert.equal((await reader.readAsync(repository.folder)).current, null);
  });

  test("fails with git's errors marked untrusted when it can't list the branches or the remotes", async () => {
    await writeFile(path.join(repository.gitFolder, "packed-refs"), "not a ref\n");
    await assert.rejects(reader.readAsync(repository.folder), (error: unknown) => {
      assert.ok(error instanceof GitFailedException);
      assert.deepEqual([error.code, error.command, error.message, error.output?.source], [FailureCode.Unavailable, "for-each-ref",
        "git for-each-ref failed; its output comes with the failure as untrusted text.", UntrustedSource.Repository]);
      assert.match(error.output?.text ?? "", /packed-refs/v);
      return true;
    });

    const runner = new ScriptedRunnerFixture(supervisor.context);
    runner.failing = "remote";
    await assert.rejects(new BranchesReader(runner).readAsync(repository.folder), {
      name: "GitFailedException",
      code: FailureCode.Unavailable,
      message: "git remote failed; its output comes with the failure as untrusted text.",
      output: { text: "scripted failure\n", source: UntrustedSource.Repository }
    });
  });

  test("fails with git's errors on an exit of symbolic-ref other than HEAD not being symbolic", async () => {
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const failing = new BranchesReader(runner);
    runner.failing = "symbolic-ref";
    runner.failingCode = 128;
    await assert.rejects(failing.readAsync(repository.folder), {
      name: "GitFailedException",
      code: FailureCode.Unavailable,
      command: "symbolic-ref",
      message: "git symbolic-ref failed; its output comes with the failure as untrusted text.",
      output: { text: "scripted failure\n", source: UntrustedSource.Repository }
    });
  });
});
