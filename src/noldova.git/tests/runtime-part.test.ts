/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chmod, mkdir, readdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, it, onTestFinished, vi } from "vitest";

import { JsonReader } from "@noldova/context.json";
import { FailureCode as DesktopCode, ShellClients } from "@noldova/desktop.protocol";
import { ClientClosure, MethodFailureException, RequestContext } from "@noldova/desktop.runtime";
import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import {
  DiffScopeKind, FailureCode, GitCommandLog, GitCommitDetail, GitCommitSignature, GitCommitSigning, GitConflict, GitDiff, GitGraph, GitJournal, GitLog, GitMarkerCheck, GitMessageReference,
  GitBranchTrack, GitMergedBranches, GitMessageReferences, GitNames, GitRemoteTracks, GitRepositories, GitStatus, GitWorktrees, type JsonValue, SignatureState, SigningFormat, UndoMode,
  WorktreeRecord
} from "@noldova/git.protocol";

import { RuntimePart } from "../src/api/index.ts";
import { WatchStart } from "../src/enums/watch-start.ts";
import { ColumnInvalidException } from "../src/exceptions/column-invalid.exception.ts";
import { GitVersion } from "../src/models/git-version.ts";
import { ChangeMonitor } from "../src/services/change-monitor.ts";
import { WorktreeTable } from "../src/services/worktree-table.ts";
import { CleanUps } from "./fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "./fixtures/desktop.fixture.ts";
import { FakeCheckpoints } from "./fixtures/fake-checkpoints.fixture.ts";
import { RepositoryFixture } from "./fixtures/repository.fixture.ts";

interface IWriteCase {
  readonly name: string;
  readonly payload: (basedOn: string) => JsonValue;
}

describe("RuntimePart", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let context: FakeRuntimePartContext;
  let part: RuntimePart;

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
    context = supervisor.context;
    context.answer("findService", () => null);
    context.settings.answer("read", () => null);
    part = new RuntimePart();
    await part.activateAsync(context);
    cleanUps.add(() => part.deactivateAsync());
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const callAsync = async (name: string, payload: JsonValue): Promise<JsonValue> => {
    const handler = supervisor.methods.get(name);
    assert.ok(handler !== undefined, name);
    return await handler.handleAsync(new RequestContext("test", payload, new AbortController().signal, 1));
  };
  const callFromAsync = async (name: string, payload: JsonValue, window: number): Promise<JsonValue> => {
    const handler = supervisor.methods.get(name);
    assert.ok(handler !== undefined, name);
    return await handler.handleAsync(new RequestContext("test", payload, new AbortController().signal, 1, window));
  };
  const linesOf = (fake: FakeRuntimePartContext): string[] => fake.log.callsOf("write").map(t => String(t[0]));
  const failure = (code: DesktopCode, gitCode: FailureCode): ((error: unknown) => boolean) => (error: unknown): boolean => {
    assert.ok(error instanceof MethodFailureException);
    assert.equal(error.failure.code, code);
    assert.equal(error.failure.details?.["code"], gitCode);
    return true;
  };

  it("registers exactly the methods module.json declares, since Noldova Desktop refuses an undeclared one and the module then fails to load", () => {
    const declaration = JsonReader.fromValue(JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8")));
    assert.deepEqual([...supervisor.methods.keys()].sort(), [...declaration.readObject("contributes").readStringArray("methods")].sort());
  });

  it("declares the worktrees table's migration", () => {
    assert.deepEqual(part.migrations, [WorktreeTable.migration]);
  });

  it("runs nothing and changes nothing on disk at activation when no worktree is recorded", async () => {
    const snapshotAsync = async (): Promise<string[]> => {
      const names = await readdir(repository.root, { recursive: true });
      return await Promise.all(names.sort().map(async t => `${t} ${(await stat(path.join(repository.root, t))).mtimeMs}`));
    };
    const before = await snapshotAsync();
    const started = supervisor.requests.length;
    const fresh = supervisor.createContext();
    const other = new RuntimePart();

    await other.activateAsync(fresh);
    await other.deactivateAsync();

    assert.equal(supervisor.requests.length, started);
    assert.deepEqual(linesOf(fresh), []);
    assert.deepEqual(new WorktreeTable(fresh.database).readAll(), []);
    assert.deepEqual(await snapshotAsync(), before);
  });

  it("clears a pending worktree record at activation, whose create never finished", async () => {
    const top = await realpath(repository.folder);
    const folder = path.join(repository.root, "work", "1f2e");
    const base = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
    const fresh = supervisor.createContext();
    new WorktreeTable(fresh.database).insertPending(new WorktreeRecord("k1", top, folder, "noldova/1f2e", base));
    const other = new RuntimePart();

    await other.activateAsync(fresh);
    await other.deactivateAsync();

    assert.deepEqual(new WorktreeTable(fresh.database).readAll(), []);
    assert.deepEqual(linesOf(fresh), [`Cleared the record of the worktree at ${folder}, whose folder or git entry is gone or was never completed.`]);
  });

  it("rejects its activation, staying inactive and registering nothing, when a stored worktree record holds an invalid state", async () => {
    const top = await realpath(repository.folder);
    const fresh = supervisor.createContext();
    new WorktreeTable(fresh.database).insertPending(new WorktreeRecord("k1", top, path.join(repository.root, "work", "1f2e"), "noldova/1f2e", "a".repeat(40)));
    fresh.database.run("PRAGMA ignore_check_constraints = ON");
    fresh.database.run("UPDATE worktrees SET state = 'Broken'");
    const other = new RuntimePart();

    await assert.rejects(other.activateAsync(fresh), (error: unknown) =>
      error instanceof ColumnInvalidException && error.message === "The module's worktree records hold an invalid state.");

    assert.deepEqual([other.isActive, fresh.callsOf("registerMethod").length, fresh.tools.callsOf("register").length, linesOf(fresh)], [false, 0, 0, []]);
  });

  it("is active from its activation until its deactivation", async () => {
    const other = new RuntimePart();
    const states: boolean[] = [other.isActive];
    await other.activateAsync(supervisor.createContext());
    states.push(other.isActive);
    await other.deactivateAsync();
    states.push(other.isActive);
    await new RuntimePart().deactivateAsync();

    assert.deepEqual(states, [false, true, false]);
  });

  it("stays inactive, offering no tools, when its activation fails", async () => {
    const other = new RuntimePart();
    const fresh = supervisor.createContext();
    const refused = new Error("Registration refused.");
    fresh.answer("registerMethod", name => {
      if (name === GitNames.pullMethod)
        throw refused;
    });

    await assert.rejects(other.activateAsync(fresh), refused);

    assert.deepEqual([other.isActive, fresh.tools.callsOf("register").length], [false, 0]);
  });

  it("stays inactive when Noldova Desktop refuses one of its tools", async () => {
    const other = new RuntimePart();
    const fresh = supervisor.createContext();
    const refused = new Error("Tool refused.");
    fresh.tools.answer("register", () => {
      throw refused;
    });

    await assert.rejects(other.activateAsync(fresh), refused);

    assert.deepEqual([other.isActive, fresh.tools.callsOf("register").length], [false, 1]);
  });

  it("registers git.status, which answers a folder inside a repository with its status", async () => {
    await repository.writeAsync("a.txt", "changed\n");

    const status = GitStatus.fromJson(await callAsync(GitNames.statusMethod, { folder: repository.folder }));

    assert.deepEqual([...supervisor.methods.keys()], [
      GitNames.statusMethod,
      GitNames.diffMethod,
      GitNames.diffTotalsMethod,
      GitNames.branchesMethod,
      GitNames.mergedBranchesMethod,
      GitNames.remoteTracksMethod,
      GitNames.logMethod,
      GitNames.graphMethod,
      GitNames.messageReferencesMethod,
      GitNames.worktreesMethod,
      GitNames.repositoryItemsMethod,
      GitNames.commitDetailMethod,
      GitNames.commitSignatureMethod,
      GitNames.commitSigningMethod,
      GitNames.pullHooksMethod,
      GitNames.avatarMethod,
      GitNames.scanRepositoriesMethod,
      GitNames.conflictMethod,
      GitNames.markerCheckMethod,
      GitNames.watchMethod,
      GitNames.unwatchMethod,
      GitNames.journalMethod,
      GitNames.commandLogMethod,
      GitNames.stageMethod,
      GitNames.unstageMethod,
      GitNames.discardMethod,
      GitNames.createBranchMethod,
      GitNames.switchBranchMethod,
      GitNames.commitMethod,
      GitNames.amendMethod,
      GitNames.pushMethod,
      GitNames.pullMethod,
      GitNames.cherryPickMethod,
      GitNames.createBranchAtMethod,
      GitNames.renameBranchMethod,
      GitNames.deleteBranchMethod,
      GitNames.createTagMethod,
      GitNames.deleteTagMethod,
      GitNames.stageLinesMethod,
      GitNames.unstageLinesMethod,
      GitNames.revertMethod,
      GitNames.undoMethod,
      GitNames.resetMethod,
      GitNames.undoCommitMethod,
      GitNames.forcePushMethod,
      GitNames.resolveConflictMethod,
      GitNames.continueOperationMethod,
      GitNames.abortOperationMethod,
      GitNames.predictMethod,
      GitNames.rebasePlanMethod,
      GitNames.rebaseCheckMethod,
      GitNames.mergeMethod,
      GitNames.rebaseMethod,
      GitNames.fetchMethod,
      GitNames.stashMethod
    ]);
    assert.equal(status.branch, "main");
    assert.deepEqual(status.entries.map(t => t.path), ["a.txt"]);
  });

  it("publishes git.repositories, whose status read answers, for the modules that depend on git", async () => {
    await repository.writeAsync("a.txt", "changed\n");

    const service = supervisor.services.get(GitNames.repositoriesService);
    assert.ok(service instanceof GitRepositories);
    const status = await service.readStatusAsync(repository.folder, new AbortController().signal);

    assert.deepEqual([[...supervisor.services.keys()], status.branch, status.entries.map(t => t.path)], [[GitNames.repositoriesService], "main", ["a.txt"]]);
  });

  it("registers git.diff, which answers the scope's diff, git.diffTotals, which counts it, and git.branches, which answers the branches and remotes", async () => {
    await repository.writeAsync("a.txt", "changed" + String.fromCharCode(10));
    await repository.runGitAsync(["branch", "feature"]);

    const diff = GitDiff.fromJson(await callAsync(GitNames.diffMethod, { folder: repository.folder, scope: { kind: DiffScopeKind.Worktree } }));
    const totals = await callAsync(GitNames.diffTotalsMethod, { folder: repository.folder, scope: { kind: DiffScopeKind.Worktree } });
    const branches = await callAsync(GitNames.branchesMethod, { folder: repository.folder });

    assert.deepEqual([diff.files.map(t => t.path), totals], [["a.txt"], { files: 1, added: 1, removed: 1 }]);
    const tip: string = (await repository.runGitAsync(["rev-parse", "main"])).trim();
    const committedAt: string = (await repository.runGitAsync(["log", "-1", "--format=%cI", "main"])).trim();
    assert.deepEqual(branches, { current: "main", branches: ["feature", "main"], remotes: [], remoteBranches: [], tracks: [],
      tips: [{ branch: "feature", id: tip, committedAt }, { branch: "main", id: tip, committedAt }] });
  });

  it("registers git.mergedBranches, which answers the local branches merged into the branch a remote's HEAD names", async () => {
    await repository.runGitAsync(["remote", "add", "origin", "https://host/c/d"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/main", "HEAD"]);
    await repository.runGitAsync(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);

    const answer = GitMergedBranches.fromJson(await callAsync(GitNames.mergedBranchesMethod, { folder: repository.folder }));

    assert.deepEqual(answer, new GitMergedBranches("origin/main", ["main"]));
  });

  it("registers git.remoteTracks, which answers how far each remote branch is ahead of and behind HEAD on a git from 2.41", async () => {
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/old", "HEAD"]);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "--message", "Ahead"]);

    const answer = GitRemoteTracks.fromJson(await callAsync(GitNames.remoteTracksMethod, { folder: repository.folder }));

    assert.deepEqual(answer, new GitRemoteTracks(await repository.hasGitAsync(new GitVersion(2, 41)) ? [new GitBranchTrack("origin/old", 0, 1)] : []));
  });

  it("registers git.log, which answers HEAD's newest commits up to the limit", async () => {
    const log = GitLog.fromJson(await callAsync(GitNames.logMethod, { folder: repository.folder, limit: 1 }));

    assert.deepEqual([log.commits.map(t => t.subject), log.truncated], [["Start"], false]);
    await assert.rejects(callAsync(GitNames.logMethod, { folder: repository.folder, limit: 0 }), failure(DesktopCode.InvalidParams, FailureCode.Refused));
  });

  it("registers git.worktrees, which answers the repository's worktrees", async () => {
    const answer = GitWorktrees.fromJson(await callAsync(GitNames.worktreesMethod, { folder: repository.folder }));

    assert.deepEqual(answer.worktrees.map(t => [path.resolve(t.path), t.branch]), [[path.resolve(repository.folder), "main"]]);
  });

  it("registers git.graph, which answers a page of every branch's commits with their labels", async () => {
    const answer = GitGraph.fromJson(await callAsync(GitNames.graphMethod, { folder: repository.folder, limit: 10, skip: 0 }));

    assert.deepEqual([answer.commits.map(t => t.commit.subject), answer.commits[0]?.refs.map(t => t.name), answer.truncated], [["Start"], ["main", "main"], false]);
  });

  it("registers git.messageReferences, which answers the commits whose messages name AB#N", async () => {
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Guard tag case", "-m", "Fixes AB#7531."]);
    const id = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();

    const answer = GitMessageReferences.fromJson(await callAsync(GitNames.messageReferencesMethod, { folder: repository.folder, kind: "AzureBoards", limit: 10 }));

    assert.deepEqual(answer, new GitMessageReferences([new GitMessageReference(id, [7531])], false));
  });

  it("registers git.repositoryItems, which answers the repository's tags, stashes and submodules", async () => {
    await repository.runGitAsync(["tag", "v1"]);

    const answer = await callAsync(GitNames.repositoryItemsMethod, { folder: repository.folder });

    assert.deepEqual(answer, { tags: [{ name: "v1", id: (await repository.runGitAsync(["rev-parse", "HEAD"])).trim() }], stashes: [], submodules: [], truncated: false });
  });

  it("registers git.commitDetail, which answers a commit's body and committer", async () => {
    const id = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();

    const answer = GitCommitDetail.fromJson(await callAsync(GitNames.commitDetailMethod, { folder: repository.folder, id }));

    assert.deepEqual([answer.id, answer.body, answer.truncated], [id, "", false]);
  });

  it("registers git.commitSignature, which answers whether a commit is signed", async () => {
    const id = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();

    const answer = GitCommitSignature.fromJson(await callAsync(GitNames.commitSignatureMethod, { folder: repository.folder, id }));

    assert.deepEqual(answer, new GitCommitSignature(id, SignatureState.None, null, null));
  });

  it("registers git.commitSigning, which answers whether a commit will be signed and with which format", async () => {
    await repository.runGitAsync(["config", "--local", "commit.gpgsign", "true"]);
    await repository.runGitAsync(["config", "--local", "gpg.format", "ssh"]);

    const answer = GitCommitSigning.fromJson(await callAsync(GitNames.commitSigningMethod, { folder: repository.folder }));

    assert.deepEqual(answer, new GitCommitSigning(true, SigningFormat.Ssh));
  });

  it("registers git.pullHooks, which answers the repository's hooks that a pull runs", async () => {
    assert.deepEqual(await callAsync(GitNames.pullHooksMethod, { folder: repository.folder }), { hooks: [] });
    const hook = path.join(repository.gitFolder, "hooks", "post-merge");
    await writeFile(hook, "#!/bin/sh\nexit 0\n");
    await chmod(hook, 0o755);

    assert.deepEqual(await callAsync(GitNames.pullHooksMethod, { folder: repository.folder }), { hooks: ["post-merge"] });
  });

  it("registers git.scanRepositories, which answers that a repository is one and lists the repositories in a folder's subfolders, and refuses a call without a folder", async () => {
    const parent = path.join(repository.root, "scanned");
    await mkdir(path.join(parent, "site", ".git"), { recursive: true });

    assert.deepEqual(await callAsync(GitNames.scanRepositoriesMethod, { folder: repository.folder }), { end: "Repository", repositories: [] });
    assert.deepEqual(await callAsync(GitNames.scanRepositoriesMethod, { folder: parent }), { end: "Complete", repositories: [path.join(parent, "site")] });
    await assert.rejects(callAsync(GitNames.scanRepositoriesMethod, {}), { name: "JsonException", path: "$.folder" });
  });

  it("registers git.avatar, which answers an author's Gravatar picture as a data address, and refuses a call without an email", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string): Promise<Response> => {
      asked.push(url);
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/png" } });
    });
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });

    assert.deepEqual(await callAsync(GitNames.avatarMethod, { email: "kim@example.com" }), { image: "data:image/png;base64,AQID" });
    assert.equal(asked.length, 1);
    await assert.rejects(callAsync(GitNames.avatarMethod, {}), { name: "JsonException", path: "$.email" });
  });

  it("answers no picture and asks Gravatar nothing while the Gravatar setting is off", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string): Promise<Response> => {
      asked.push(url);
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/png" } });
    });
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    context.settings.answer("read", (name: string) => name === "git.gravatar" ? false : null);

    assert.deepEqual([await callAsync(GitNames.avatarMethod, { email: "kim@example.com" }), asked], [{ image: null }, []]);
  });

  it("registers git.watch and git.unwatch and declares git.changed, which each window watching a folder of a changed repository hears, answering a watch once it has started", async () => {
    const changed = [GitNames.changedEvent, 1, 2, { folder: repository.folder }];
    const order: string[] = [];
    const startedAsync = ChangeMonitor.prototype.startedAsync;
    const spy = vi.spyOn(ChangeMonitor.prototype, "startedAsync").mockImplementation(async function (this: ChangeMonitor, key: string) {
      const start = await startedAsync.call(this, key);
      order.push(start);
      return start;
    });
    onTestFinished(() => spy.mockRestore());

    assert.deepEqual(context.callsOf("declareEvent").map(t => t[0]), [GitNames.changedEvent]);
    assert.equal(await callFromAsync(GitNames.watchMethod, { folder: repository.folder }, 2), null);
    order.push("answered");
    assert.deepEqual(order, [WatchStart.Seen, "answered"]);
    await supervisor.publishedToAsync(2);
    assert.deepEqual(supervisor.published[0], changed);
    assert.equal(await callFromAsync(GitNames.watchMethod, { folder: repository.folder }, 3), null);
    await repository.writeAsync("a.txt", "changed" + String.fromCharCode(10));
    await repository.runGitAsync(["commit", "--quiet", "-am", "Changed"]);
    await supervisor.publishedToAsync(3);
    assert.deepEqual(supervisor.published.filter(t => t[2] === 3)[0], [GitNames.changedEvent, 1, 3, { folder: repository.folder }]);

    assert.equal(await callFromAsync(GitNames.unwatchMethod, { folder: repository.folder }, 2), null);
    assert.equal(await callFromAsync(GitNames.unwatchMethod, { folder: repository.folder }, 3), null);
    assert.equal(await callFromAsync(GitNames.unwatchMethod, { folder: repository.folder }, 3), null);
    assert.equal(await callFromAsync(GitNames.watchMethod, { folder: repository.folder }, 2), null);
    await context.raiseClientClosedAsync(new ClientClosure(1, null));
    assert.equal(await callFromAsync(GitNames.unwatchMethod, { folder: repository.folder }, 2), null);
  });

  it("cancels a watch whose unwatch, or whose window's closure, comes while its repository is read", async () => {
    const heard = (window: number): number => supervisor.published.filter(t => t[2] === window).length;
    const unwatched = callFromAsync(GitNames.watchMethod, { folder: repository.folder }, 2);
    assert.equal(await callFromAsync(GitNames.unwatchMethod, { folder: repository.folder }, 2), null);
    assert.equal(await unwatched, null);
    const closed = callFromAsync(GitNames.watchMethod, { folder: repository.folder }, 4);
    await context.raiseClientClosedAsync(new ClientClosure(1, 4));
    assert.equal(await closed, null);

    assert.equal(await callFromAsync(GitNames.watchMethod, { folder: repository.folder }, 3), null);
    await supervisor.publishedToAsync(3);
    assert.deepEqual([heard(2), heard(4)], [0, 0]);
  });

  it("forgets a watch whose start failed, stopping its monitor, so a window's Check again starts it afresh and one unwatch ends it", async () => {
    const watching = vi.spyOn(ChangeMonitor.prototype, "watch");
    const unwatching = vi.spyOn(ChangeMonitor.prototype, "unwatch");
    const starting = vi.spyOn(ChangeMonitor.prototype, "startedAsync").mockRejectedValueOnce(new Error("no start"));
    onTestFinished(() => [watching, unwatching, starting].forEach(t => t.mockRestore()));

    await assert.rejects(callFromAsync(GitNames.watchMethod, { folder: repository.folder }, 2));
    const afterFailure = [watching.mock.calls.length, unwatching.mock.calls.length];
    assert.equal(await callFromAsync(GitNames.watchMethod, { folder: repository.folder }, 2), null);
    assert.equal(await callFromAsync(GitNames.unwatchMethod, { folder: repository.folder }, 2), null);
    const afterUnwatch = unwatching.mock.calls.length;
    assert.equal(await callFromAsync(GitNames.watchMethod, { folder: repository.folder }, 2), null);

    assert.deepEqual([afterFailure, watching.mock.calls.length, afterUnwatch], [[1, 2], 3, 4]);
  });

  it("starts no watch for a request cancelled while its repository is read", async () => {
    const watching = vi.spyOn(ChangeMonitor.prototype, "watch");
    onTestFinished(() => watching.mockRestore());
    const handler = supervisor.methods.get(GitNames.watchMethod);
    assert.ok(handler !== undefined);
    const cancelled = new AbortController();
    cancelled.abort();

    await assert.rejects(handler.handleAsync(new RequestContext("test", { folder: repository.folder }, cancelled.signal, 1, 2)));
    const afterCancel = watching.mock.calls.length;
    assert.equal(await callFromAsync(GitNames.unwatchMethod, { folder: repository.folder }, 2), null);

    assert.deepEqual([afterCancel, watching.mock.calls.length], [0, 0]);
  });

  it("watches a repository that keeps its refs in a reftable, so a window hears its branch move there", async context => {
    context.skip(!(await repository.hasGitAsync(new GitVersion(2, 45))), "git keeps refs in a reftable from 2.45; an older git can't make or read one.");
    const reftable = path.join(repository.root, "reftable");
    await repository.runGitAsync(["init", "--quiet", "--ref-format=reftable", reftable]);
    await repository.runGitAsync(["-C", reftable, "commit", "--quiet", "--allow-empty", "-m", "First"]);

    assert.equal(await callFromAsync(GitNames.watchMethod, { folder: reftable }, 5), null);
    await supervisor.publishedToAsync(5);
    supervisor.published.splice(0);
    const tree = (await repository.runGitAsync(["-C", reftable, "rev-parse", "HEAD^{tree}"])).trim();
    const next = (await repository.runGitAsync(["-C", reftable, "commit-tree", tree, "-p", "HEAD", "-m", "Second"])).trim();
    await repository.runGitAsync(["-C", reftable, "update-ref", "HEAD", next]);
    await supervisor.publishedToAsync(5);

    assert.deepEqual(supervisor.published.filter(t => t[2] === 5)[0], [GitNames.changedEvent, 1, 5, { folder: reftable }]);
  });

  it("answers git.watch's failures as git.status's: refused parameters as invalid, and a folder outside a repository as not found", async () => {
    await assert.rejects(callFromAsync(GitNames.watchMethod, { folder: "relative" }, 2), failure(DesktopCode.InvalidParams, FailureCode.Refused));
    await assert.rejects(callFromAsync(GitNames.watchMethod, { folder: repository.home }, 2), failure(DesktopCode.NotFound, FailureCode.NotRepository));
    await assert.rejects(callFromAsync(GitNames.unwatchMethod, { folder: "relative" }, 2), failure(DesktopCode.InvalidParams, FailureCode.Refused));
  });

  it("answers git.status's failures with Noldova Desktop's codes: refused parameters as invalid, and a folder outside a repository as not found", async () => {
    await assert.rejects(callAsync(GitNames.statusMethod, { folder: "relative" }), failure(DesktopCode.InvalidParams, FailureCode.Refused));
    await assert.rejects(callAsync(GitNames.statusMethod, { folder: repository.home }), failure(DesktopCode.NotFound, FailureCode.NotRepository));
  });

  describe("its write methods", () => {
    const writeAsync = async (name: string, payload: JsonValue, client: string = ShellClients.mainProcess, window: number | null = 2): Promise<JsonValue> => {
      const handler = supervisor.methods.get(name);
      assert.ok(handler !== undefined, name);
      return await handler.handleAsync(new RequestContext(client, payload, new AbortController().signal, 1, window));
    };
    const basedOnAsync = async (): Promise<string> => GitStatus.fromJson(await callAsync(GitNames.statusMethod, { folder: repository.folder })).fingerprint;
    const unauthorized = (error: unknown): boolean =>
      error instanceof MethodFailureException && error.failure.code === DesktopCode.Unauthorized
      && error.failure.message === "Only the app writes to a repository for a person's own click; an agent's write goes through its tools.";
    const writes: IWriteCase[] = [
      { name: GitNames.stageMethod, payload: basedOn => ({ folder: repository.folder, paths: ["a.txt"], basedOn }) },
      { name: GitNames.unstageMethod, payload: basedOn => ({ folder: repository.folder, paths: ["a.txt"], basedOn }) },
      { name: GitNames.discardMethod, payload: basedOn => ({ folder: repository.folder, paths: ["a.txt"], basedOn }) },
      { name: GitNames.createBranchMethod, payload: basedOn => ({ folder: repository.folder, name: "feature", basedOn }) },
      { name: GitNames.switchBranchMethod, payload: basedOn => ({ folder: repository.folder, name: "feature", basedOn }) },
      { name: GitNames.commitMethod, payload: basedOn => ({ folder: repository.folder, message: "Change a", basedOn }) },
      { name: GitNames.amendMethod, payload: basedOn => ({ folder: repository.folder, message: "Change a", basedOn }) },
      { name: GitNames.pushMethod, payload: basedOn => ({ folder: repository.folder, basedOn }) },
      { name: GitNames.pullMethod, payload: basedOn => ({ folder: repository.folder, basedOn }) },
      { name: GitNames.cherryPickMethod, payload: basedOn => ({ folder: repository.folder, id: "0".repeat(40), basedOn }) },
      { name: GitNames.revertMethod, payload: basedOn => ({ folder: repository.folder, id: "0".repeat(40), basedOn }) },
      { name: GitNames.createBranchAtMethod, payload: basedOn => ({ folder: repository.folder, name: "feature", id: "0".repeat(40), basedOn }) },
      { name: GitNames.renameBranchMethod, payload: basedOn => ({ folder: repository.folder, name: "main", newName: "trunk", basedOn }) },
      { name: GitNames.deleteBranchMethod, payload: basedOn => ({ folder: repository.folder, name: "feature", basedOn }) },
      { name: GitNames.createTagMethod, payload: basedOn => ({ folder: repository.folder, name: "v1", id: "0".repeat(40), basedOn }) },
      { name: GitNames.deleteTagMethod, payload: basedOn => ({ folder: repository.folder, name: "v1", basedOn }) },
      { name: GitNames.stageLinesMethod, payload: basedOn => ({ folder: repository.folder, path: "a.txt", lines: [0], basedOn }) },
      { name: GitNames.unstageLinesMethod, payload: basedOn => ({ folder: repository.folder, path: "a.txt", lines: [0], basedOn }) },
      { name: GitNames.undoMethod, payload: basedOn => ({ folder: repository.folder, id: "1", basedOn }) },
      { name: GitNames.resetMethod, payload: basedOn => ({ folder: repository.folder, id: "0".repeat(40), mode: "Soft", basedOn }) },
      { name: GitNames.undoCommitMethod, payload: basedOn => ({ folder: repository.folder, basedOn }) },
      { name: GitNames.forcePushMethod, payload: basedOn => ({ folder: repository.folder, expected: "0".repeat(40), basedOn }) },
      { name: GitNames.resolveConflictMethod, payload: basedOn => ({ folder: repository.folder, path: "a.txt", resolution: "Ours", text: null, basedOn }) },
      { name: GitNames.continueOperationMethod, payload: basedOn => ({ folder: repository.folder, basedOn }) },
      { name: GitNames.abortOperationMethod, payload: basedOn => ({ folder: repository.folder, basedOn }) },
      { name: GitNames.mergeMethod, payload: basedOn => ({ folder: repository.folder, id: "0".repeat(40), basedOn }) },
      { name: GitNames.rebaseMethod, payload: basedOn => ({ folder: repository.folder, onto: "0".repeat(40), steps: [{ id: "1".repeat(40), action: "Pick", message: null }], updateRefs: false, basedOn }) },
      { name: GitNames.fetchMethod, payload: basedOn => ({ folder: repository.folder, basedOn }) },
      { name: GitNames.stashMethod, payload: basedOn => ({ folder: repository.folder, message: null, includeUntracked: false, basedOn }) }
    ];

    for (const { name, payload } of writes)
      it(`refuses ${name} from any caller but the app's main process acting for a window, before reading its request`, async () => {
        await repository.writeAsync("a.txt", "changed\n");
        const basedOn = await basedOnAsync();

        await assert.rejects(writeAsync(name, payload(basedOn), "test"), unauthorized);
        await assert.rejects(writeAsync(name, payload(basedOn), ShellClients.commandLine), unauthorized);
        await assert.rejects(writeAsync(name, payload(basedOn), ShellClients.mainProcess, null), unauthorized);
        await assert.rejects(writeAsync(name, { refused: true }, "test"), unauthorized);

        assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), " M a.txt\n");
        assert.equal((await repository.runGitAsync(["branch", "--show-current"])).trim(), "main");
      });

    it("fetches and pulls for a person's click and answers null, refusing a moved status as Stale and a branch without an upstream before git runs", async () => {
      const remote = path.join(repository.root, "remote.git");

      await assert.rejects(writeAsync(GitNames.pullMethod, { folder: repository.folder, basedOn: "old" }), failure(DesktopCode.Conflict, FailureCode.Stale));
      await assert.rejects(writeAsync(GitNames.pullMethod, { folder: repository.folder, basedOn: await basedOnAsync() }), failure(DesktopCode.Internal, FailureCode.Git));
      await assert.rejects(writeAsync(GitNames.fetchMethod, { folder: repository.folder, basedOn: await basedOnAsync() }), failure(DesktopCode.Internal, FailureCode.Git));
      await repository.runGitAsync(["clone", "--bare", "--quiet", repository.folder, remote]);
      await repository.runGitAsync(["remote", "add", "origin", remote]);
      await repository.runGitAsync(["fetch", "--quiet", "origin"]);
      await repository.runGitAsync(["branch", "--quiet", "--set-upstream-to=origin/main"]);

      assert.equal(await writeAsync(GitNames.fetchMethod, { folder: repository.folder, basedOn: await basedOnAsync() }), null);
      assert.equal(await writeAsync(GitNames.pullMethod, { folder: repository.folder, basedOn: await basedOnAsync() }), null);
    });

    it("predicts a merge of a branch as a fast-forward, merges it for a person's click and answers null, then predicts it up to date", async () => {
      await repository.runGitAsync(["switch", "--quiet", "--create", "side"]);
      await repository.writeAsync("b.txt", "b\n");
      await repository.runGitAsync(["add", "b.txt"]);
      await repository.runGitAsync(["commit", "--quiet", "-m", "Add b"]);
      const id = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
      await repository.runGitAsync(["switch", "--quiet", "main"]);

      assert.deepEqual(await callAsync(GitNames.predictMethod, { folder: repository.folder, id, action: "Merge" }), { outcome: "FastForward", paths: [] });
      assert.equal(await writeAsync(GitNames.mergeMethod, { folder: repository.folder, id, basedOn: await basedOnAsync() }), null);

      assert.equal((await repository.runGitAsync(["rev-parse", "HEAD"])).trim(), id);
      assert.deepEqual(await callAsync(GitNames.predictMethod, { folder: repository.folder, id, action: "Merge" }), { outcome: "UpToDate", paths: [] });
    });

    it("answers git.rebasePlan with the commits the current branch would replay onto a commit", async () => {
      const onto = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
      await repository.runGitAsync(["switch", "--quiet", "--create", "side"]);
      await repository.writeAsync("b.txt", "b\n");
      await repository.runGitAsync(["add", "b.txt"]);
      await repository.runGitAsync(["commit", "--quiet", "-m", "Add b"]);
      const id = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();

      assert.deepEqual(await callAsync(GitNames.rebasePlanMethod, { folder: repository.folder, onto }), {
        branch: "side", onto, base: onto, ontoAhead: 0, commits: [{ id, message: "Add b", fixupOf: null }], stacked: [], pushed: false
      });
      assert.deepEqual(await callAsync(GitNames.rebaseCheckMethod, { folder: repository.folder, onto, steps: [{ id, action: "Pick", message: null }] }), {
        steps: [{ outcome: await repository.hasGitAsync(new GitVersion(2, 45)) ? "Clean" : "Unavailable", paths: [] }]
      });
      await repository.runGitAsync(["switch", "--quiet", "main"]);
      await repository.writeAsync("c.txt", "c\n");
      await repository.runGitAsync(["add", "c.txt"]);
      await repository.runGitAsync(["commit", "--quiet", "-m", "Add c"]);
      const main = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
      await repository.runGitAsync(["switch", "--quiet", "side"]);

      assert.equal(await writeAsync(GitNames.rebaseMethod, {
        folder: repository.folder, onto: main, steps: [{ id, action: "Reword", message: "Add b, reworded" }], updateRefs: true, basedOn: await basedOnAsync()
      }), null);
      assert.equal(await repository.runGitAsync(["log", "--format=%s", "main~1..side"]), "Add b, reworded\nAdd c\n");
    });

    it("cherry-picks and reverts a commit for a person's click and answers null, refusing a moved status as Stale before git runs", async () => {
      await repository.writeAsync("a.txt", "changed\n");
      await repository.runGitAsync(["commit", "--quiet", "-am", "Change a"]);
      const id = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();

      await assert.rejects(writeAsync(GitNames.revertMethod, { folder: repository.folder, id, basedOn: "old" }), failure(DesktopCode.Conflict, FailureCode.Stale));
      assert.equal(await writeAsync(GitNames.revertMethod, { folder: repository.folder, id, basedOn: await basedOnAsync() }), null);
      assert.equal(await writeAsync(GitNames.cherryPickMethod, { folder: repository.folder, id, basedOn: await basedOnAsync() }), null);

      assert.deepEqual((await repository.runGitAsync(["log", "-3", "--format=%s"])).trim().split("\n"), ["Change a", "Revert \"Change a\"", "Change a"]);
      assert.equal(await writeAsync(GitNames.createBranchAtMethod, { folder: repository.folder, name: "at-change", id, basedOn: await basedOnAsync() }), null);
      assert.equal((await repository.runGitAsync(["rev-parse", "at-change"])).trim(), id);
      assert.equal(await writeAsync(GitNames.renameBranchMethod, { folder: repository.folder, name: "at-change", newName: "renamed", basedOn: await basedOnAsync() }), null);
      assert.equal(await writeAsync(GitNames.createTagMethod, { folder: repository.folder, name: "v1", id, basedOn: await basedOnAsync() }), null);
      assert.equal((await repository.runGitAsync(["rev-parse", "v1"])).trim(), id);
      assert.equal(await writeAsync(GitNames.deleteTagMethod, { folder: repository.folder, name: "v1", basedOn: await basedOnAsync() }), null);
      assert.equal(await writeAsync(GitNames.deleteBranchMethod, { folder: repository.folder, name: "renamed", basedOn: await basedOnAsync() }), null);
      assert.equal((await repository.runGitAsync(["for-each-ref", "--format=%(refname)", "refs/tags", "refs/heads/renamed"])).trim(), "");
      assert.equal(await writeAsync(GitNames.amendMethod, { folder: repository.folder, message: "Change a again", basedOn: await basedOnAsync() }), null);
      assert.deepEqual((await repository.runGitAsync(["log", "-2", "--format=%s"])).trim().split("\n"), ["Change a again", "Revert \"Change a\""]);
    });

    it("stages and unstages chosen lines for a person's click and answers null, refusing a moved status as Stale before git runs", async () => {
      await repository.writeAsync("a.txt", "changed" + String.fromCharCode(10) + "more" + String.fromCharCode(10));

      await assert.rejects(writeAsync(GitNames.stageLinesMethod, { folder: repository.folder, path: "a.txt", lines: [1], basedOn: "old" }), failure(DesktopCode.Conflict, FailureCode.Stale));
      assert.equal(await writeAsync(GitNames.stageLinesMethod, { folder: repository.folder, path: "a.txt", lines: [2], basedOn: await basedOnAsync() }), null);
      assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), "MM a.txt" + String.fromCharCode(10));
      assert.equal(await writeAsync(GitNames.unstageLinesMethod, { folder: repository.folder, path: "a.txt", lines: [1], basedOn: await basedOnAsync() }), null);
      assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), " M a.txt" + String.fromCharCode(10));
    });

    it("reads a conflict, checks for leftover markers, resolves it, continues and aborts for a person's click and answers null, refusing a moved status as Stale before git runs", async () => {
      await repository.runGitAsync(["switch", "--quiet", "--create", "side"]);
      await repository.writeAsync("a.txt", "side\n");
      await repository.runGitAsync(["commit", "--quiet", "-am", "Side"]);
      await repository.runGitAsync(["switch", "--quiet", "main"]);
      await repository.writeAsync("a.txt", "main\n");
      await repository.runGitAsync(["commit", "--quiet", "-am", "Main"]);
      await repository.runGitAsync(["merge", "--quiet", "side"]).catch(() => "");

      const conflict = GitConflict.fromJson(await callAsync(GitNames.conflictMethod, { folder: repository.folder, path: "a.txt" }));
      assert.deepEqual([conflict.ours, conflict.theirs, conflict.oursLabel, conflict.theirsLabel], ["main\n", "side\n", "main", "side"]);
      const resolve = { folder: repository.folder, path: "a.txt", resolution: "Text", text: "both\n" };
      await assert.rejects(writeAsync(GitNames.resolveConflictMethod, { ...resolve, basedOn: "old" }), failure(DesktopCode.Conflict, FailureCode.Stale));
      assert.equal(await writeAsync(GitNames.resolveConflictMethod, { ...resolve, basedOn: await basedOnAsync() }), null);
      assert.deepEqual(GitMarkerCheck.fromJson(await callAsync(GitNames.markerCheckMethod, { folder: repository.folder })).paths, []);
      assert.equal(await writeAsync(GitNames.continueOperationMethod, { folder: repository.folder, basedOn: await basedOnAsync() }), null);
      assert.deepEqual([(await repository.runGitAsync(["log", "-1", "--format=%s"])).trim(), await repository.runGitAsync(["show", "HEAD:a.txt"])],
        ["Merge branch 'side'", "both\n"]);
      await repository.runGitAsync(["reset", "--quiet", "--hard", "HEAD~1"]);
      await repository.runGitAsync(["merge", "--quiet", "side"]).catch(() => "");
      await assert.rejects(writeAsync(GitNames.abortOperationMethod, { folder: repository.folder, basedOn: "old" }), failure(DesktopCode.Conflict, FailureCode.Stale));

      assert.equal(await writeAsync(GitNames.abortOperationMethod, { folder: repository.folder, basedOn: await basedOnAsync() }), null);
      assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), "");
    });

    it("stages, discards, commits, creates and switches branches for a person's click, each on the status it is based on, and answers null", async () => {
      await repository.writeAsync("a.txt", "changed\n");
      assert.equal(await writeAsync(GitNames.discardMethod, { folder: repository.folder, paths: ["a.txt"], basedOn: await basedOnAsync() }), null);
      assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), "");
      await repository.writeAsync("a.txt", "changed\n");
      assert.equal(await writeAsync(GitNames.stageMethod, { folder: repository.folder, paths: ["a.txt"], basedOn: await basedOnAsync() }), null);
      assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), "M  a.txt\n");
      assert.equal(await writeAsync(GitNames.unstageMethod, { folder: repository.folder, paths: ["a.txt"], basedOn: await basedOnAsync() }), null);
      assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), " M a.txt\n");
      await writeAsync(GitNames.stageMethod, { folder: repository.folder, paths: ["a.txt"], basedOn: await basedOnAsync() });
      assert.equal(await writeAsync(GitNames.commitMethod, { folder: repository.folder, message: "Change a", basedOn: await basedOnAsync() }), null);
      assert.equal((await repository.runGitAsync(["log", "-1", "--format=%s"])).trim(), "Change a");
      assert.equal(await writeAsync(GitNames.createBranchMethod, { folder: repository.folder, name: "feature", basedOn: await basedOnAsync() }), null);
      assert.equal((await repository.runGitAsync(["branch", "--show-current"])).trim(), "feature");
      assert.equal(await writeAsync(GitNames.switchBranchMethod, { folder: repository.folder, name: "main", basedOn: await basedOnAsync() }), null);
      assert.equal((await repository.runGitAsync(["branch", "--show-current"])).trim(), "main");
    });

    it("journals a person's writes, undoes one by its entry, resets, and refuses undoing the first commit and a force push without an upstream", async () => {
      const first = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
      await repository.writeAsync("a.txt", "changed\n");
      await writeAsync(GitNames.stageMethod, { folder: repository.folder, paths: ["a.txt"], basedOn: await basedOnAsync() });
      await writeAsync(GitNames.commitMethod, { folder: repository.folder, message: "Change a", basedOn: await basedOnAsync() });
      const journal = GitJournal.fromJson(await callAsync(GitNames.journalMethod, { folder: repository.folder }));
      const commit = journal.entries.find(t => t.method === GitNames.commitMethod);
      assert.ok(commit !== undefined);
      assert.equal(journal.checkpoints, false);

      assert.equal(await writeAsync(GitNames.undoMethod, { folder: repository.folder, id: commit.id, basedOn: await basedOnAsync() }), null);
      assert.equal((await repository.runGitAsync(["rev-parse", "HEAD"])).trim(), first);
      assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), "M  a.txt\n");
      await writeAsync(GitNames.commitMethod, { folder: repository.folder, message: "Change a", basedOn: await basedOnAsync() });
      assert.equal(await writeAsync(GitNames.resetMethod, { folder: repository.folder, id: first, mode: "Mixed", basedOn: await basedOnAsync() }), null);
      assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), " M a.txt\n");
      await assert.rejects(writeAsync(GitNames.undoCommitMethod, { folder: repository.folder, basedOn: await basedOnAsync() }), failure(DesktopCode.InvalidParams, FailureCode.Refused));
      await assert.rejects(writeAsync(GitNames.forcePushMethod, { folder: repository.folder, expected: first, basedOn: await basedOnAsync() }),
        failure(DesktopCode.InvalidParams, FailureCode.Refused));
      assert.deepEqual(GitJournal.fromJson(await callAsync(GitNames.journalMethod, { folder: repository.folder })).entries.map(t => t.method),
        [GitNames.stageMethod, GitNames.undoMethod, GitNames.commitMethod, GitNames.resetMethod]);
    });

    it("logs the git commands a person's writes run, without the module's own settings, and none of its reads", async () => {
      await repository.writeAsync("a.txt", "changed\n");
      await writeAsync(GitNames.stageMethod, { folder: repository.folder, paths: ["a.txt"], basedOn: await basedOnAsync() });
      await writeAsync(GitNames.commitMethod, { folder: repository.folder, message: "Change a", basedOn: await basedOnAsync() });

      const log = GitCommandLog.fromJson(await callAsync(GitNames.commandLogMethod, { folder: repository.folder }));
      assert.deepEqual(log.commands.map(t => [t.line.split(" ").slice(0, 2).join(" "), t.exitCode]), [["git add", 0], ["git commit", 0]]);
      assert.ok(log.commands.every(t => !t.line.includes("core.fsmonitor")));
    });

    it("finds the checkpoints module's service for each discard and its undo, and says in the journal whether a discard can be undone", async () => {
      const checkpoints = new FakeCheckpoints();
      const names: string[] = [];
      context.answer("findService", <T extends object>(name: string, guard: (service: object) => service is T): T | null => {
        names.push(name);
        return guard(checkpoints) ? checkpoints : null;
      });
      checkpoints.onRestore = async () => await repository.writeAsync("a.txt", "changed\n");
      await repository.writeAsync("a.txt", "changed\n");

      await writeAsync(GitNames.discardMethod, { folder: repository.folder, paths: ["a.txt"], basedOn: await basedOnAsync() });
      const journal = GitJournal.fromJson(await callAsync(GitNames.journalMethod, { folder: repository.folder }));
      const discard = journal.entries.at(-1);
      assert.ok(discard !== undefined);
      await writeAsync(GitNames.undoMethod, { folder: repository.folder, id: discard.id, basedOn: await basedOnAsync() });

      assert.deepEqual([journal.checkpoints, discard.undo, discard.paths], [true, UndoMode.Checkpoint, ["a.txt"]]);
      assert.deepEqual([names.every(t => t === "checkpoints.service"), checkpoints.captures.length, checkpoints.restores.length], [true, 1, 1]);
      assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), " M a.txt\n");
    });

    it("tells the change monitor when a person's write starts and ends, and gives it each git.status read's fingerprint", async () => {
      const calls: string[] = [];
      const spies = (["notifyWriting", "notifyWritten", "observe"] as const).map(name => {
        const original = ChangeMonitor.prototype[name];
        return vi.spyOn(ChangeMonitor.prototype, name).mockImplementation(function (this: ChangeMonitor, ...values: unknown[]) {
          calls.push(name);
          return (original as (...values: unknown[]) => void).apply(this, values);
        });
      });
      onTestFinished(() => spies.forEach(t => t.mockRestore()));
      await repository.writeAsync("a.txt", "changed\n");

      const status = await callAsync(GitNames.statusMethod, { folder: repository.folder });
      await writeAsync(GitNames.stageMethod, { folder: repository.folder, paths: ["a.txt"], basedOn: await basedOnAsync() });

      assert.equal(typeof status, "object");
      assert.deepEqual(calls, ["observe", "observe", "notifyWriting", "notifyWritten"]);
    });

    it("pushes the current branch to its upstream for a person's click", async () => {
      const remote = path.join(repository.root, "remote.git");
      await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
      await repository.runGitAsync(["remote", "add", "origin", remote]);
      await repository.runGitAsync(["fetch", "--quiet", "origin"]);
      await repository.runGitAsync(["branch", "--quiet", "--set-upstream-to=origin/main"]);
      await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Ahead"]);

      assert.equal(await writeAsync(GitNames.pushMethod, { folder: repository.folder, basedOn: await basedOnAsync() }), null);

      assert.equal((await repository.runGitAsync(["-C", remote, "log", "-1", "--format=%s"])).trim(), "Ahead");
    });

    it("stashes the folder's changes with their message for a person's click", async () => {
      await repository.writeAsync("a.txt", "changed\n");

      assert.equal(await writeAsync(GitNames.stashMethod, { folder: repository.folder, message: "Lanes", includeUntracked: false, basedOn: await basedOnAsync() }), null);

      assert.deepEqual([await repository.runGitAsync(["status", "--porcelain=v1"]), (await repository.runGitAsync(["stash", "list", "--format=%s"])).trim()], ["", "On main: Lanes"]);
    });

    it("refuses a write whose status moved, and refuses parameters before anything runs", async () => {
      const basedOn = await basedOnAsync();
      await repository.writeAsync("a.txt", "changed\n");

      await assert.rejects(writeAsync(GitNames.stageMethod, { folder: repository.folder, paths: ["a.txt"], basedOn }), failure(DesktopCode.Conflict, FailureCode.Stale));
      await assert.rejects(writeAsync(GitNames.stageMethod, { folder: repository.folder, paths: [], basedOn }), failure(DesktopCode.InvalidParams, FailureCode.Refused));
      assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), " M a.txt\n");
    });
  });
});
