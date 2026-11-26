/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { FailureCode, GitBranchTrack, GitMergedBranches, GitRemoteTracks, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { UnreadableOutputException } from "../../src/exceptions/unreadable-output.exception.ts";
import { Resources } from "../../src/resources.ts";
import { BranchesReader } from "../../src/services/branches.reader.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
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
    const runner: ProgramRunner = new ProgramRunner(supervisor.context);
    reader = new BranchesReader(runner, new GitVersionReader(runner));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const readerOn = (runner: ProgramRunner): BranchesReader => new BranchesReader(runner, new GitVersionReader(runner));

  const readerOnGit = (version: string, runner: ProgramRunner): BranchesReader => {
    const versions = new ScriptedRunnerFixture(supervisor.context);
    versions.answering = ["version", `git version ${version}\n`];
    return new BranchesReader(runner, new GitVersionReader(versions));
  };

  test("reads the local branches in git's order, the one checked out, the remotes and their branches without each remote's HEAD, how far branches are from their upstreams"
    + " and when each tip was committed", async () => {
    await repository.runGitAsync(["branch", "feature/login"]);
    await repository.runGitAsync(["branch", "Zeta"]);
    await repository.runGitAsync(["remote", "add", "upstream", "https://host/a/b"]);
    await repository.runGitAsync(["remote", "add", "origin", "https://host/c/d"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/main", "HEAD"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/upstream/feature/login", "HEAD"]);
    await repository.runGitAsync(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "--message", "Ahead"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/upstream/feature/login", "HEAD"]);
    await repository.runGitAsync(["branch", "--quiet", "--set-upstream-to=origin/main", "main"]);
    await repository.runGitAsync(["branch", "--quiet", "--set-upstream-to=upstream/feature/login", "Zeta"]);
    const tipOf = async (branch: string): Promise<string> => (await repository.runGitAsync(["rev-parse", branch])).trim();
    const zeta: string = await tipOf("Zeta");
    const login: string = await tipOf("feature/login");
    const main: string = await tipOf("main");
    const timeOf = async (branch: string): Promise<string> => (await repository.runGitAsync(["log", "-1", "--format=%cI", branch])).trim();

    assert.deepEqual((await reader.readAsync(repository.folder)).toJson(), {
      current: "main",
      branches: ["Zeta", "feature/login", "main"],
      remotes: ["origin", "upstream"],
      remoteBranches: ["origin/main", "upstream/feature/login"],
      tracks: [{ branch: "Zeta", ahead: 0, behind: 1 }, { branch: "main", ahead: 1, behind: 0 }],
      tips: [{ branch: "Zeta", id: zeta, committedAt: await timeOf("Zeta") }, { branch: "feature/login", id: login, committedAt: await timeOf("feature/login") },
        { branch: "main", id: main, committedAt: await timeOf("main") }]
    });
  });

  test("reads a branch whose tip's committer offset git prints malformed at the same moment in UTC, with the other branches", async () => {
    const head: string = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
    const tree: string = (await repository.runGitAsync(["rev-parse", "HEAD^{tree}"])).trim();
    const commit: string = [`tree ${tree}`, `parent ${head}`, "author A <a@example.invalid> 1700000000 +0000", "committer A <a@example.invalid> 1700000000 +051800", "",
      "Odd zone", ""].join("\n");
    const odd: string = (await repository.runGitAsync(["hash-object", "-t", "commit", "-w", "--literally", "--stdin"], commit)).trim();
    await repository.runGitAsync(["update-ref", "refs/heads/odd", odd]);

    const tips = (await reader.readAsync(repository.folder)).tips;

    assert.deepEqual(tips.map(t => [t.branch, t.branch === "odd" ? t.committedAt : t.id]), [["main", head], ["odd", "2023-11-14T22:13:20Z"]]);
  });

  test("skips a remote branch whose name the list can't carry, and keeps a branch named HEAD under a folder, dropping only each remote's own HEAD", async () => {
    await repository.runGitAsync(["remote", "add", "origin", "https://host/c/d"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/main", "HEAD"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/release/HEAD", "HEAD"]);
    await repository.runGitAsync(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
    const head: string = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
    const packed: string = path.join(repository.gitFolder, "packed-refs");
    const kept: readonly string[] = existsSync(packed) ? (await readFile(packed, "utf8")).split("\n").filter(t => t.length > 0 && !t.startsWith("#")) : [];
    await writeFile(packed, [...kept, `${head} refs/remotes/origin/${"a".repeat(100)}/${"b".repeat(100)}/${"c".repeat(100)}`, ""].join("\n"));

    assert.deepEqual((await reader.readAsync(repository.folder)).remoteBranches, ["origin/main", "origin/release/HEAD"]);
  });

  test("names no branch checked out on a detached HEAD, and the unborn branch before the first commit", async () => {
    await repository.runGitAsync(["checkout", "--quiet", "--detach"]);
    assert.equal((await reader.readAsync(repository.folder)).current, null);

    const empty = path.join(repository.root, "empty");
    await repository.runGitAsync(["init", "--quiet", "--initial-branch=start", empty]);
    assert.deepEqual((await reader.readAsync(empty)).toJson(), { current: "start", branches: [], remotes: [], remoteBranches: [], tracks: [], tips: [] });
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
    await assert.rejects(readerOn(runner).readAsync(repository.folder), {
      name: "GitFailedException",
      code: FailureCode.Unavailable,
      message: "git remote failed; its output comes with the failure as untrusted text.",
      output: { text: "scripted failure\n", source: UntrustedSource.Repository }
    });
  });

  test("refuses a list of branches, remote branches or merged branches git cut at the read's size limit", async () => {
    await repository.runGitAsync(["remote", "add", "origin", "https://host/c/d"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/HEAD", "HEAD"]);
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const scripted = readerOn(runner);

    runner.truncating = "upstream:track";
    await assert.rejects(scripted.readAsync(repository.folder), {
      name: "UnreadableOutputException",
      message: "git for-each-ref printed refs that the module can't read."
    });
    runner.truncating = "refs/remotes";
    await assert.rejects(scripted.readAsync(repository.folder), UnreadableOutputException);
    await assert.rejects(scripted.readMergedAsync(repository.folder), UnreadableOutputException);
    runner.truncating = "--merged";
    await assert.rejects(scripted.readMergedAsync(repository.folder), UnreadableOutputException);
    runner.truncating = null;
    assert.deepEqual(await scripted.readMergedAsync(repository.folder), new GitMergedBranches("origin/HEAD", ["main"]));
  });

  test("fails with git's errors on an exit of symbolic-ref other than HEAD not being symbolic", async () => {
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const failing = readerOn(runner);
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

  test("reads the local branches merged into the first remote whose HEAD names a branch, and that branch", async () => {
    await repository.runGitAsync(["branch", "feature/done"]);
    await repository.runGitAsync(["remote", "add", "alpha", "https://host/a/b"]);
    await repository.runGitAsync(["remote", "add", "origin", "https://host/c/d"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/alpha/main", "HEAD"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/main", "HEAD"]);
    await repository.runGitAsync(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
    await repository.runGitAsync(["checkout", "--quiet", "-b", "feature/open"]);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "--message", "Open work"]);

    assert.deepEqual(await reader.readMergedAsync(repository.folder), new GitMergedBranches("origin/main", ["feature/done", "main"]));
  });

  test("names the remote's HEAD itself as the base when it isn't symbolic, and reads none merged without a remote HEAD", async () => {
    await repository.runGitAsync(["remote", "add", "origin", "https://host/c/d"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/main", "HEAD"]);

    assert.deepEqual(await reader.readMergedAsync(repository.folder), new GitMergedBranches(null, []));
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/HEAD", "HEAD"]);
    assert.deepEqual(await reader.readMergedAsync(repository.folder), new GitMergedBranches("origin/HEAD", ["main"]));
  });

  test("fails with git's errors when it can't read which branch a remote's HEAD names", async () => {
    await repository.runGitAsync(["remote", "add", "origin", "https://host/c/d"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/main", "HEAD"]);
    await repository.runGitAsync(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
    const runner = new ScriptedRunnerFixture(supervisor.context);
    runner.failing = "symbolic-ref";
    runner.failingCode = 128;
    await assert.rejects(readerOn(runner).readMergedAsync(repository.folder), {
      name: "GitFailedException",
      command: "symbolic-ref",
      output: { text: "scripted failure\n", source: UntrustedSource.Repository }
    });
  });

  test("reads how far each remote branch is ahead of and behind HEAD, skipping each remote's HEAD, the branches level with it and a ref that names no commit, on a git from 2.41", async () => {
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/old", "HEAD"]);
    await repository.runGitAsync(["checkout", "--quiet", "-b", "side"]);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "--message", "Side"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/feature/x", "HEAD"]);
    await repository.runGitAsync(["checkout", "--quiet", "main"]);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "--message", "Main"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/level", "HEAD"]);
    await repository.runGitAsync(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/level"]);
    await repository.runGitAsync(["checkout", "--quiet", "-b", "next"]);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "--message", "Next"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/upstream/next", "HEAD"]);
    await repository.runGitAsync(["checkout", "--quiet", "main"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/tree", "HEAD^{tree}"]);
    const tracks: readonly GitBranchTrack[] = [new GitBranchTrack("origin/feature/x", 1, 1), new GitBranchTrack("origin/old", 0, 1), new GitBranchTrack("upstream/next", 1, 0)];

    assert.deepEqual(await reader.readRemoteTracksAsync(repository.folder),
      new GitRemoteTracks(await repository.hasGitAsync(Resources.aheadBehindVersion) ? tracks : []));
  });

  test("reads the counts git prints for each remote branch once, keeping those ahead or behind, skipping a ref with no commit, a remote's own HEAD and a name the list"
    + " can't carry, and refuses a line it can't read", async () => {
    await repository.runGitAsync(["remote", "add", "origin", "https://host/c/d"]);
    await repository.runGitAsync(["remote", "add", "up", "https://host/e/f"]);
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const commands: string[] = [];
    runner.starting = command => commands.push(command);
    runner.answering = ["ahead-behind", "refs/remotes/origin/HEAD\t0 2\0\nrefs/remotes/origin/a\t3 1\0\nrefs/remotes/origin/t\t\0\nrefs/remotes/origin/b\t0 0\0\n"
      + `refs/remotes/origin/release/HEAD\t2 0\0\nrefs/remotes/origin/${"x".repeat(300)}\t1 1\0\nrefs/remotes/up/c\t0 4\0\n`];
    const scripted = readerOnGit("2.41.0", runner);

    assert.deepEqual(await scripted.readRemoteTracksAsync(repository.folder),
      new GitRemoteTracks([new GitBranchTrack("origin/a", 3, 1), new GitBranchTrack("origin/release/HEAD", 2, 0), new GitBranchTrack("up/c", 0, 4)]));
    assert.deepEqual(commands.map(t => t.split(" ").find(u => u === "rev-parse" || u === "for-each-ref" || u === "remote")), ["rev-parse", "for-each-ref", "remote"]);
    runner.answering = ["ahead-behind", "refs/remotes/origin/a\t3\0\n"];
    await assert.rejects(scripted.readRemoteTracksAsync(repository.folder), {
      name: "UnreadableOutputException",
      message: "git for-each-ref printed refs that the module can't read."
    });
  });

  test("reads no remote tracks, running nothing, on a git older than 2.41, and none before HEAD's first commit", async () => {
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/old", "HEAD"]);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "--message", "Ahead"]);
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const commands: string[] = [];
    runner.starting = command => commands.push(command);

    assert.deepEqual([await readerOnGit("2.40.1", runner).readRemoteTracksAsync(repository.folder), commands], [new GitRemoteTracks([]), []]);
    await repository.runGitAsync(["checkout", "--quiet", "--orphan", "fresh"]);
    assert.deepEqual(await readerOnGit("2.41.0", runner).readRemoteTracksAsync(repository.folder), new GitRemoteTracks([]));
    assert.deepEqual(await reader.readRemoteTracksAsync(repository.folder), new GitRemoteTracks([]));
  });

  test("fails with git's errors when it can't check HEAD or list the remote branches", async () => {
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const failing = readerOnGit("2.41.0", runner);
    runner.failing = "rev-parse";
    runner.failingCode = 128;
    await assert.rejects(failing.readRemoteTracksAsync(repository.folder), {
      name: "GitFailedException",
      command: "rev-parse",
      output: { text: "scripted failure\n", source: UntrustedSource.Repository }
    });
    runner.failing = "ahead-behind";
    await assert.rejects(failing.readRemoteTracksAsync(repository.folder), {
      name: "GitFailedException",
      command: "for-each-ref",
      output: { text: "scripted failure\n", source: UntrustedSource.Repository }
    });
  });
});
