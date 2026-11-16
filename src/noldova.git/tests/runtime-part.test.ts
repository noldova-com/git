/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { chmod, readdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, it, onTestFinished, vi } from "vitest";

import { FailureCode as DesktopCode, ShellClients } from "@noldova/desktop.protocol";
import { ClientClosure, MethodFailureException, RequestContext } from "@noldova/desktop.runtime";
import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import { DiffScopeKind, FailureCode, GitDiff, GitLog, GitNames, GitRepositories, GitStatus, GitWorktrees, type JsonValue, WorktreeRecord } from "@noldova/git.protocol";

import { RuntimePart } from "../src/api/index.ts";
import { WatchStart } from "../src/enums/watch-start.ts";
import { ColumnInvalidException } from "../src/exceptions/column-invalid.exception.ts";
import { ChangeMonitor } from "../src/services/change-monitor.ts";
import { WorktreeTable } from "../src/services/worktree-table.ts";
import { DesktopFixture } from "./fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "./fixtures/repository.fixture.ts";

describe("RuntimePart", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
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
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    context = supervisor.context;
    part = new RuntimePart();
    await part.activateAsync(context);
  });

  afterEach(async () => {
    await part.deactivateAsync();
    await supervisor.disposeAsync();
    await repository.disposeAsync();
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
      GitNames.branchesMethod,
      GitNames.logMethod,
      GitNames.worktreesMethod,
      GitNames.pullHooksMethod,
      GitNames.watchMethod,
      GitNames.unwatchMethod,
      GitNames.stageMethod,
      GitNames.unstageMethod,
      GitNames.createBranchMethod,
      GitNames.switchBranchMethod,
      GitNames.commitMethod,
      GitNames.pushMethod,
      GitNames.pullMethod
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

  it("registers git.diff, which answers the scope's diff, and git.branches, which answers the branches and remotes", async () => {
    await repository.writeAsync("a.txt", "changed" + String.fromCharCode(10));
    await repository.runGitAsync(["branch", "feature"]);

    const diff = GitDiff.fromJson(await callAsync(GitNames.diffMethod, { folder: repository.folder, scope: { kind: DiffScopeKind.Worktree } }));
    const branches = await callAsync(GitNames.branchesMethod, { folder: repository.folder });

    assert.deepEqual(diff.files.map(t => t.path), ["a.txt"]);
    assert.deepEqual(branches, { current: "main", branches: ["feature", "main"], remotes: [], remoteBranches: [] });
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

  it("registers git.pullHooks, which answers the repository's hooks that a pull runs", async () => {
    assert.deepEqual(await callAsync(GitNames.pullHooksMethod, { folder: repository.folder }), { hooks: [] });
    const hook = path.join(repository.gitFolder, "hooks", "post-merge");
    await writeFile(hook, "#!/bin/sh\nexit 0\n");
    await chmod(hook, 0o755);

    assert.deepEqual(await callAsync(GitNames.pullHooksMethod, { folder: repository.folder }), { hooks: ["post-merge"] });
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
    const writes: [string, (basedOn: string) => JsonValue][] = [
      [GitNames.stageMethod, basedOn => ({ folder: repository.folder, paths: ["a.txt"], basedOn })],
      [GitNames.unstageMethod, basedOn => ({ folder: repository.folder, paths: ["a.txt"], basedOn })],
      [GitNames.createBranchMethod, basedOn => ({ folder: repository.folder, name: "feature", basedOn })],
      [GitNames.switchBranchMethod, basedOn => ({ folder: repository.folder, name: "feature", basedOn })],
      [GitNames.commitMethod, basedOn => ({ folder: repository.folder, message: "Change a", basedOn })],
      [GitNames.pushMethod, basedOn => ({ folder: repository.folder, basedOn })],
      [GitNames.pullMethod, basedOn => ({ folder: repository.folder, basedOn })]
    ];

    for (const [name, payload] of writes)
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

    it("pulls for a person's click and answers null, refusing a moved status as Stale and a branch without an upstream before git runs", async () => {
      const remote = path.join(repository.root, "remote.git");

      await assert.rejects(writeAsync(GitNames.pullMethod, { folder: repository.folder, basedOn: "old" }), failure(DesktopCode.Conflict, FailureCode.Stale));
      await assert.rejects(writeAsync(GitNames.pullMethod, { folder: repository.folder, basedOn: await basedOnAsync() }), failure(DesktopCode.Internal, FailureCode.Git));
      await repository.runGitAsync(["clone", "--bare", "--quiet", repository.folder, remote]);
      await repository.runGitAsync(["remote", "add", "origin", remote]);
      await repository.runGitAsync(["fetch", "--quiet", "origin"]);
      await repository.runGitAsync(["branch", "--quiet", "--set-upstream-to=origin/main"]);

      assert.equal(await writeAsync(GitNames.pullMethod, { folder: repository.folder, basedOn: await basedOnAsync() }), null);
    });

    it("stages, commits, creates and switches branches for a person's click, each on the status it is based on, and answers null", async () => {
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

    it("refuses a write whose status moved, and refuses parameters before anything runs", async () => {
      const basedOn = await basedOnAsync();
      await repository.writeAsync("a.txt", "changed\n");

      await assert.rejects(writeAsync(GitNames.stageMethod, { folder: repository.folder, paths: ["a.txt"], basedOn }), failure(DesktopCode.Conflict, FailureCode.Stale));
      await assert.rejects(writeAsync(GitNames.stageMethod, { folder: repository.folder, paths: [], basedOn }), failure(DesktopCode.InvalidParams, FailureCode.Refused));
      assert.equal(await repository.runGitAsync(["status", "--porcelain=v1"]), " M a.txt\n");
    });
  });
});
