/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { access, appendFile, readdir, realpath, rename, rm, truncate, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { DiffScope, DiffScopeKind, FailureCode, FileChange, GitCode, RiskLevel, UntrustedSource, WorktreeRecord } from "@noldova/git.protocol";

import { BranchKeptException } from "../../src/exceptions/branch-kept.exception.ts";
import { BranchUnmergedException } from "../../src/exceptions/branch-unmerged.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { RequestDeniedException } from "../../src/exceptions/request-denied.exception.ts";
import { WorktreeService } from "../../src/services/worktree.service.ts";
import { WorktreeTable } from "../../src/services/worktree-table.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { PermissionGateFixture } from "../fixtures/permission-gate.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("WorktreeService", () => {
  const KEY = "conversation:QA-KEY-ÆØ-7f3c";
  const LOCK_REASON = "In use by the Git module; remove it through the app that made it.";
  const context = { scope: "project-1", sessionId: "session-1" };
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  let desktop: DesktopFixture;
  let runner: ScriptedRunnerFixture;
  let gate: PermissionGateFixture;
  let service: WorktreeService;
  let work: string;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    desktop = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    runner = new ScriptedRunnerFixture(desktop.context);
    gate = new PermissionGateFixture();
    service = new WorktreeService(desktop.context, runner);
    work = await realpath(await desktop.context.getWorkFolderAsync());
  });

  afterEach(async () => {
    await desktop.disposeAsync();
    await repository.disposeAsync();
  });

  const lines = (): string[] => desktop.context.log.callsOf("write").map(t => String(t[0]));
  const listAsync = async (): Promise<string[][]> =>
    (await repository.runGitAsync(["worktree", "list", "--porcelain", "-z"])).split("\0\0").filter(t => t.length > 0).map(t => t.split("\0"));
  const entryOf = async (folder: string): Promise<string[] | undefined> =>
    (await listAsync()).find(t => t[0] !== undefined && path.resolve(t[0].slice("worktree ".length)) === path.resolve(folder));
  const branchesAsync = async (): Promise<string[]> =>
    (await repository.runGitAsync(["branch", "--format=%(refname:short)"])).split("\n").filter(t => t.length > 0);
  const headAsync = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();
  const existsAsync = async (folder: string): Promise<boolean> => access(folder).then(() => true, () => false);
  const failure = (name: string, code: FailureCode, gitCode: GitCode | null = null): { name: string; code: FailureCode; gitCode: GitCode | null } =>
    ({ name, code, gitCode });
  const untrusted = { text: "scripted failure\n", source: UntrustedSource.Repository };
  const gitFailure = (command: string): { name: string; code: FailureCode; gitCode: GitCode | null; message: string; output: typeof untrusted } =>
    ({ ...failure("GitFailedException", FailureCode.Unavailable), message: `git ${command} failed; its output comes with the failure as untrusted text.`, output: untrusted });
  const gitRefusal = (command: string, said: RegExp) => (error: unknown): boolean => {
    assert.ok(error instanceof GitFailedException);
    assert.deepEqual([error.code, error.gitCode, error.message, error.output?.source],
      [FailureCode.Unavailable, null, `git ${command} failed; its output comes with the failure as untrusted text.`, UntrustedSource.Repository]);
    assert.match(error.output?.text ?? "", said);
    return true;
  };
  const createAsync = (key: string = KEY): Promise<WorktreeRecord> => service.createWorktreeAsync(key, { repository: repository.folder });
  const addForeignAsync = async (): Promise<readonly [string, string]> => {
    const locked = path.join(repository.root, "foreign-locked");
    const plain = path.join(repository.root, "foreign-plain");
    await repository.runGitAsync(["worktree", "add", "--quiet", "-b", "foreign-1", locked, "HEAD"]);
    await repository.runGitAsync(["worktree", "lock", "--reason", "other-tool", locked]);
    await repository.runGitAsync(["worktree", "add", "--quiet", "-b", "foreign-2", plain, "HEAD"]);
    return [locked, plain];
  };

  describe("createWorktreeAsync", () => {
    test("creates a locked worktree on a new branch under the work folder, records it, and keeps the key out of every name", async () => {
      const record = await createAsync();

      assert.equal(record.key, KEY);
      assert.equal(record.repository, path.resolve(repository.folder));
      assert.equal(path.dirname(record.path), work);
      assert.match(path.basename(record.path), /^[0-9a-f]{16}$/);
      assert.equal(record.branch, `noldova/${path.basename(record.path)}`);
      assert.equal(record.base, await headAsync("HEAD"));
      assert.deepEqual((await entryOf(record.path))?.slice(1), [
        `HEAD ${record.base}`,
        `branch refs/heads/${record.branch}`,
        `locked ${LOCK_REASON}`
      ]);
      assert.equal((await readdir(record.path)).includes("a.txt"), true);
      const listing = await repository.runGitAsync(["worktree", "list", "--porcelain"]);
      for (const part of ["conversation", "QA-KEY", "ÆØ", "7f3c"]) {
        assert.equal(record.path.includes(part), false);
        assert.equal(record.branch.includes(part), false);
        assert.equal(listing.includes(part), false);
        assert.equal((await branchesAsync()).some(t => t.includes(part)), false);
      }
      assert.equal(desktop.context.database.read("SELECT state FROM worktrees WHERE key = ?", KEY)?.["state"], "Ready");
    });

    test("gives the same worktree for the same key, also when asked twice at once, with no second worktree or branch", async () => {
      const [first, second] = await Promise.all([createAsync(), createAsync()]);
      const again = await createAsync();

      assert.deepEqual(second.toJson(), first.toJson());
      assert.deepEqual(again.toJson(), first.toJson());
      assert.equal((await listAsync()).length, 2);
      assert.deepEqual(await branchesAsync(), ["main", first.branch]);
    });

    test("creates distinct worktrees for two keys at once, five times over", async () => {
      for (let round = 0; round < 5; round++) {
        const [first, second] = await Promise.all([createAsync(`a${round}`), createAsync(`b${round}`)]);

        assert.notEqual(first.path, second.path);
        assert.notEqual(first.branch, second.branch);
      }
      assert.equal((await listAsync()).length, 11);
    });

    test("starts from the given base on the given branch, such as a remote branch of a clone", async () => {
      const remote = path.join(repository.root, "remote.git");
      const clone = path.join(repository.root, "clone");
      await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
      await repository.runGitAsync(["clone", "--quiet", remote, clone]);

      const record = await service.createWorktreeAsync(KEY, { repository: clone, base: "origin/main", branch: "feature/login" });

      assert.equal(record.repository, path.resolve(clone));
      assert.equal(record.branch, "feature/login");
      assert.equal(record.base, await headAsync("main"));
      await service.removeWorktreeAsync(KEY, { gate, context });
    });

    for (const [label, options, expected] of [
      ["a base that isn't a commit", { base: "no-such-branch" }, failure("BaseInvalidException", FailureCode.Refused)],
      ["an invalid branch name", { branch: "bad..name" }, failure("BranchInvalidException", FailureCode.Refused)],
      ["a branch checked out in another worktree", { branch: "main" }, failure("WorktreeBranchCheckedOutException", FailureCode.Git, GitCode.BranchCheckedOut)]
    ] as const)
      test(`refuses ${label}, and changes nothing`, async () => {
        await assert.rejects(service.createWorktreeAsync(KEY, { repository: repository.folder, ...options }), expected);

        assert.equal((await listAsync()).length, 1);
        assert.deepEqual(await branchesAsync(), ["main"]);
        assert.equal(await service.findWorktreeAsync(KEY), null);
      });

    test("refuses a branch that exists but isn't checked out, and changes nothing", async () => {
      await repository.runGitAsync(["branch", "kept"]);

      await assert.rejects(service.createWorktreeAsync(KEY, { repository: repository.folder, branch: "kept" }), failure("BranchExistsException", FailureCode.Refused));

      assert.equal((await listAsync()).length, 1);
      assert.equal(await service.findWorktreeAsync(KEY), null);
    });

    test("refuses a folder that is missing or outside a repository", async () => {
      const outside = path.join(repository.root, "home");

      await assert.rejects(service.createWorktreeAsync(KEY, { repository: path.join(repository.root, "missing") }), failure("NotARepositoryException", FailureCode.NotRepository));
      await assert.rejects(service.createWorktreeAsync(KEY, { repository: outside }), failure("NotARepositoryException", FailureCode.NotRepository));
    });

    test("refuses a key that already has a worktree in another repository", async () => {
      const other = path.join(repository.root, "other");
      await repository.runGitAsync(["init", "--quiet", other]);
      await createAsync();

      await assert.rejects(service.createWorktreeAsync(KEY, { repository: other }), failure("KeyInOtherRepositoryException", FailureCode.Refused));
    });

    test("forgets the pending record when git fails to add the worktree", async () => {
      await writeFile(path.join(repository.gitFolder, "worktrees"), "not a folder\n");

      await assert.rejects(createAsync(), gitRefusal("worktree add", /worktrees/v));

      assert.equal(desktop.context.database.read("SELECT key FROM worktrees"), undefined);
    });

    test("doesn't start when the signal has already aborted", async () => {
      const signal = AbortSignal.abort(new Error("Stopped."));

      await assert.rejects(service.createWorktreeAsync(KEY, { repository: repository.folder, signal }), { message: "Stopped." });

      assert.equal(await service.findWorktreeAsync(KEY), null);
    });

    test("stops with the signal's reason when cancelled before it writes, and creates nothing", async () => {
      const cancel = new AbortController();
      const creating = service.createWorktreeAsync(KEY, { repository: repository.folder, signal: cancel.signal });
      cancel.abort(new Error("Stopped."));

      await assert.rejects(creating, { message: "Stopped." });

      assert.equal(await service.findWorktreeAsync(KEY), null);
      assert.equal((await listAsync()).length, 1);
      assert.deepEqual(await branchesAsync(), ["main"]);
    });

    test("reports an unknown outcome when cancelled after its write started, and the creation still finishes", async () => {
      const cancel = new AbortController();
      runner.starting = command => {
        if (command.includes("worktree add"))
          cancel.abort();
      };

      await assert.rejects(service.createWorktreeAsync(KEY, { repository: repository.folder, signal: cancel.signal }), failure("WorktreeOutcomeUnknownException", FailureCode.Git, GitCode.OutcomeUnknown));

      const record = await service.findWorktreeAsync(KEY);
      assert.notEqual(record, null);
      assert.notEqual(await entryOf(record?.path ?? ""), undefined);
    });
  });

  describe("findWorktreeAsync", () => {
    test("returns null for an unknown key, and the record for a created one", async () => {
      assert.equal(await service.findWorktreeAsync(KEY), null);
      const record = await createAsync();

      assert.deepEqual((await service.findWorktreeAsync(KEY))?.toJson(), record.toJson());
    });

    test("clears a worktree whose folder was deleted by hand, leaves other worktrees alone, and lets the key create a fresh one", async () => {
      const [locked, plain] = await addForeignAsync();
      const record = await createAsync();
      await rm(record.path, { recursive: true, force: true });

      assert.equal(await service.findWorktreeAsync(KEY), null);

      assert.equal(await entryOf(record.path), undefined);
      assert.deepEqual((await entryOf(locked))?.slice(2), ["branch refs/heads/foreign-1", "locked other-tool"]);
      assert.deepEqual((await entryOf(plain))?.slice(2), ["branch refs/heads/foreign-2"]);
      assert.equal(lines().length, 1);
      assert.match(lines()[0] ?? "", /^Cleared the record of the worktree at /);
      assert.equal(lines().some(t => t.includes("QA-KEY")), false);
      const fresh = await createAsync();
      assert.notEqual(fresh.path, record.path);
      assert.notEqual(fresh.branch, record.branch);
      assert.equal((await branchesAsync()).includes(record.branch), true);
    });

    test("clears an unlocked worktree whose folder is gone, and one whose git entry is gone", async () => {
      const unlocked = await createAsync("a");
      const pruned = await createAsync("b");
      await repository.runGitAsync(["worktree", "unlock", unlocked.path]);
      await rm(unlocked.path, { recursive: true, force: true });
      await repository.runGitAsync(["worktree", "unlock", pruned.path]);
      await repository.runGitAsync(["worktree", "remove", "--force", pruned.path]);

      assert.equal(await service.findWorktreeAsync("a"), null);
      assert.equal(await service.findWorktreeAsync("b"), null);

      assert.equal((await listAsync()).length, 1);
      assert.equal(desktop.context.database.read("SELECT key FROM worktrees"), undefined);
    });

    test("leaves the git entry of a worktree another tool locked, even when its folder is gone", async () => {
      const record = await createAsync();
      await repository.runGitAsync(["worktree", "unlock", record.path]);
      await repository.runGitAsync(["worktree", "lock", "--reason", "other-tool", record.path]);

      assert.deepEqual((await service.findWorktreeAsync(KEY))?.toJson(), record.toJson());
      await rm(record.path, { recursive: true, force: true });
      assert.equal(await service.findWorktreeAsync(KEY), null);

      assert.equal((await entryOf(record.path))?.at(-1), "locked other-tool");
    });

    test("reports a worktree list it can't read whole, or at all", async () => {
      await createAsync();
      runner.truncating = "worktree list";

      await assert.rejects(service.findWorktreeAsync(KEY), failure("WorktreeListTooLargeException", FailureCode.TooLarge));

      runner.truncating = null;
      runner.failing = "worktree list";
      runner.failingCode = 128;
      await assert.rejects(service.findWorktreeAsync(KEY), gitFailure("worktree list"));
    });
  });

  describe("removeWorktreeAsync", () => {
    test("removes a clean worktree without asking, keeps its branch, and forgets it", async () => {
      const record = await createAsync();

      await service.removeWorktreeAsync(KEY, { gate, context });

      assert.equal(gate.requests.length, 0);
      assert.equal(await existsAsync(record.path), false);
      assert.equal(await entryOf(record.path), undefined);
      assert.equal((await branchesAsync()).includes(record.branch), true);
      assert.equal(await service.findWorktreeAsync(KEY), null);
    });

    test("leaves a key with no worktree as it is", async () => {
      await service.removeWorktreeAsync(KEY, { gate, context });

      assert.equal((await listAsync()).length, 1);
    });

    test("deletes a merged branch when asked, and keeps an unmerged one as BranchUnmerged after removing the worktree", async () => {
      const merged = await createAsync("a");
      const unmerged = await createAsync("b");
      await repository.runGitAsync(["-C", unmerged.path, "commit", "--quiet", "--allow-empty", "-m", "Work"]);

      await service.removeWorktreeAsync("a", { gate, context, keepBranch: false });
      const removing = service.removeWorktreeAsync("b", { gate, context, keepBranch: false });

      await assert.rejects(removing, { ...failure("BranchUnmergedException", FailureCode.Git, GitCode.BranchUnmerged), message: `The worktree was removed, but git kept its branch ${unmerged.branch}, which holds commits that aren't merged.` });
      const output = await removing.catch((error: unknown) => error instanceof BranchUnmergedException ? error.output : null);
      assert.equal(output?.source, UntrustedSource.Repository);
      assert.equal(output?.text.includes(unmerged.branch), true);

      assert.equal((await branchesAsync()).includes(merged.branch), false);
      assert.equal((await branchesAsync()).includes(unmerged.branch), true);
      assert.equal(await entryOf(unmerged.path), undefined);
    });

    test("judges a kept branch by its upstream, or by HEAD once the upstream is gone", async () => {
      const remote = path.join(repository.root, "remote.git");
      const clone = path.join(repository.root, "clone");
      await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
      await repository.runGitAsync(["clone", "--quiet", remote, clone]);
      const tracked = await service.createWorktreeAsync("a", { repository: clone, branch: "feature/a" });
      const orphaned = await service.createWorktreeAsync("b", { repository: clone, branch: "feature/b" });
      for (const record of [tracked, orphaned]) {
        await repository.runGitAsync(["-C", record.path, "commit", "--quiet", "--allow-empty", "-m", `Work on ${record.branch}`]);
        await repository.runGitAsync(["-C", clone, "branch", "--quiet", "--set-upstream-to=origin/main", record.branch]);
      }
      await repository.runGitAsync(["-C", clone, "merge", "--quiet", "--ff-only", tracked.branch]);
      const unmerged = failure("BranchUnmergedException", FailureCode.Git, GitCode.BranchUnmerged);

      await assert.rejects(service.removeWorktreeAsync("a", { gate, context, keepBranch: false }), unmerged);
      await repository.runGitAsync(["-C", clone, "update-ref", "-d", "refs/remotes/origin/main"]);
      await assert.rejects(service.removeWorktreeAsync("b", { gate, context, keepBranch: false }), unmerged);
    });

    test("reports a branch git keeps for another reason as Unavailable, with git's output", async () => {
      const record = await createAsync();
      await writeFile(path.join(repository.gitFolder, "refs", "heads", `${record.branch}.lock`), "");

      await assert.rejects(service.removeWorktreeAsync(KEY, { gate, context, keepBranch: false }), (error: unknown) => {
        assert.ok(error instanceof BranchKeptException);
        assert.deepEqual([error.code, error.message, error.output?.source], [FailureCode.Unavailable,
          `The worktree was removed, but git kept its branch ${record.branch}; git's output says why.`, UntrustedSource.Repository]);
        assert.match(error.output?.text ?? "", /cannot lock ref/v);
        return true;
      });
      assert.equal(await existsAsync(record.path), false);
    });

    for (const [command, failing, code] of [
      ["show-ref --verify", "show-ref", 128],
      ["for-each-ref --format=%(upstream)", "for-each-ref", 128],
      ["merge-base --is-ancestor", "merge-base", 128]
    ] as const)
      test(`reports a failed ${failing} while it deletes the branch, rather than guess`, async () => {
        const record = await createAsync();
        await repository.runGitAsync(["-C", record.path, "commit", "--quiet", "--allow-empty", "-m", "Work"]);
        runner.failing = failing;
        runner.failingCode = code;

        await assert.rejects(service.removeWorktreeAsync(KEY, { gate, context, keepBranch: false }), gitFailure(command));
      });

    test("asks before removing a worktree with changes, and keeps it when denied", async () => {
      const record = await createAsync();
      await writeFile(path.join(record.path, "a.txt"), "changed\n");
      await writeFile(path.join(record.path, "new.txt"), "new\n");
      gate.answerNext(new RequestDeniedException());

      await assert.rejects(service.removeWorktreeAsync(KEY, { gate, context }), failure("RequestDeniedException", FailureCode.Denied));

      const [request] = gate.requests;
      assert.equal(request?.requester, "git");
      assert.equal(request?.action, "git.removeWorktree");
      assert.equal(request?.risk, RiskLevel.LocalDestructive);
      assert.equal(request?.scope, "project-1");
      assert.equal(request?.sessionId, "session-1");
      assert.equal(request?.worktree, record.path);
      assert.equal(request?.branch, record.branch);
      assert.equal(request?.head, record.base);
      assert.deepEqual(request?.changes.paths, ["a.txt", "new.txt"]);
      assert.equal(request?.changes.isTruncated, false);
      assert.equal(request?.snapshot, null);
      assert.equal((await entryOf(record.path))?.at(-1), `locked ${LOCK_REASON}`);
      assert.notEqual(await service.findWorktreeAsync(KEY), null);
    });

    test("removes a worktree with changes once allowed, keeping its branch, for an app call with no agent session", async () => {
      const record = await createAsync();
      await writeFile(path.join(record.path, "new.txt"), "new\n");
      gate.answerNext(null);

      await service.removeWorktreeAsync(KEY, { gate, context: { scope: "project-1" } });

      assert.equal(gate.requests[0]?.scope, "project-1");
      assert.equal(gate.requests[0]?.sessionId, null);
      assert.equal(await existsAsync(record.path), false);
      assert.equal((await branchesAsync()).includes(record.branch), true);
    });

    test("removes nothing when the changes moved after the answer", async () => {
      const record = await createAsync();
      await writeFile(path.join(record.path, "new.txt"), "new\n");
      gate.beforeAnswerAsync = () => writeFile(path.join(record.path, "later.txt"), "later\n");
      gate.answerNext(null);

      await assert.rejects(service.removeWorktreeAsync(KEY, { gate, context }), failure("StaleRemovalException", FailureCode.Stale));

      assert.equal(await existsAsync(record.path), true);
      assert.notEqual(await service.findWorktreeAsync(KEY), null);
    });

    test("removes nothing when a file that had already changed changes again after the answer", async () => {
      const record = await createAsync();
      await writeFile(path.join(record.path, "a.txt"), "changed\n");
      gate.beforeAnswerAsync = () => writeFile(path.join(record.path, "a.txt"), "changed again\n");
      gate.answerNext(null);

      await assert.rejects(service.removeWorktreeAsync(KEY, { gate, context }), failure("StaleRemovalException", FailureCode.Stale));

      assert.deepEqual(gate.requests[0]?.changes.paths, ["a.txt"]);
      assert.equal(await existsAsync(record.path), true);
    });

    test("refuses to ask when it can't read all of the changes, and removes nothing", async () => {
      const record = await createAsync();
      await writeFile(path.join(record.path, "new.txt"), "new\n");
      runner.truncating = "status";

      await assert.rejects(service.removeWorktreeAsync(KEY, { gate, context }), failure("ChangesTooLargeException", FailureCode.TooLarge));

      assert.equal(gate.requests.length, 0);
      assert.equal(await existsAsync(record.path), true);
    });

    test("skips the branch of a create that never finished, and clears its record", async () => {
      const table = new WorktreeTable(desktop.context.database);
      const base = await headAsync("HEAD");
      table.insertPending(new WorktreeRecord(KEY, path.resolve(repository.folder), path.join(work, "0123456789abcdef"), "noldova/0123456789abcdef", base));

      await service.removeWorktreeAsync(KEY, { gate, context, keepBranch: false });

      assert.equal(table.find(KEY), null);
      assert.deepEqual(await branchesAsync(), ["main"]);
    });

    test("refuses a worktree another tool locked", async () => {
      const record = await createAsync();
      await repository.runGitAsync(["worktree", "unlock", record.path]);
      await repository.runGitAsync(["worktree", "lock", "--reason", "other-tool", record.path]);

      await assert.rejects(service.removeWorktreeAsync(KEY, { gate, context }), failure("LockedElsewhereException", FailureCode.Git, GitCode.LockedElsewhere));

      assert.equal(await existsAsync(record.path), true);
    });

    test("clears a worktree whose folder is gone without asking", async () => {
      const record = await createAsync();
      await rm(record.path, { recursive: true, force: true });

      await service.removeWorktreeAsync(KEY, { gate, context });

      assert.equal(gate.requests.length, 0);
      assert.equal(await entryOf(record.path), undefined);
    });

    test("doesn't start when the signal has already aborted", async () => {
      await createAsync();

      await assert.rejects(service.removeWorktreeAsync(KEY, { gate, context: { ...context, signal: AbortSignal.abort(new Error("Stopped.")) } }), { message: "Stopped." });

      assert.notEqual(await service.findWorktreeAsync(KEY), null);
    });

    test("fails as withdrawn when cancelled while the request waits, and removes nothing", async () => {
      const record = await createAsync();
      await writeFile(path.join(record.path, "new.txt"), "new\n");
      gate.waitsForWithdrawal = true;
      const cancel = new AbortController();
      const removing = service.removeWorktreeAsync(KEY, { gate, context: { ...context, signal: cancel.signal } });
      await gate.asked.promise;
      cancel.abort();

      await assert.rejects(removing, failure("WorktreeWithdrawnException", FailureCode.Withdrawn));

      assert.notEqual(await service.findWorktreeAsync(KEY), null);
      assert.equal(await existsAsync(record.path), true);
    });

    test("finishes a removal that ends before any cancel", async () => {
      const record = await createAsync();

      await service.removeWorktreeAsync(KEY, { gate, context: { ...context, signal: new AbortController().signal } });

      assert.equal(await existsAsync(record.path), false);
    });
  });

  describe("reconcileAsync", () => {
    test("keeps complete worktrees, clears pending ones, and logs the worktrees it didn't make without touching them", async () => {
      const [locked, plain] = await addForeignAsync();
      const kept = await createAsync("kept");
      const table = new WorktreeTable(desktop.context.database);
      const interrupted = new WorktreeRecord("interrupted", kept.repository, path.join(work, "0123456789abcdef"), "noldova/0123456789abcdef", kept.base);
      table.insertPending(interrupted);
      await repository.runGitAsync(["worktree", "add", "--quiet", "--lock", "--reason", LOCK_REASON, "-b", interrupted.branch, interrupted.path, "HEAD"]);
      table.insertPending(new WorktreeRecord("never-added", kept.repository, path.join(work, "fedcba9876543210"), "noldova/fedcba9876543210", kept.base));

      await service.reconcileAsync();

      assert.deepEqual(table.readAll().map(t => t.record.key), ["kept"]);
      assert.equal(await entryOf(interrupted.path), undefined);
      assert.notEqual(await entryOf(kept.path), undefined);
      assert.deepEqual((await entryOf(locked))?.slice(2), ["branch refs/heads/foreign-1", "locked other-tool"]);
      assert.deepEqual((await entryOf(plain))?.slice(2), ["branch refs/heads/foreign-2"]);
      const notOurs = lines().filter(t => t.startsWith("Left alone the worktree at "));
      assert.equal(notOurs.length, 2);
      assert.equal(notOurs.some(t => t.includes("foreign-locked")), true);
      assert.equal(notOurs.some(t => t.includes("foreign-plain")), true);
      assert.equal(lines().filter(t => t.startsWith("Cleared the record")).length, 2);
    });

    test("logs a repository it can't read, and keeps its records", async () => {
      await createAsync();
      const moved = `${repository.folder}-moved`;
      await rename(repository.folder, moved);

      await service.reconcileAsync();

      await rename(moved, repository.folder);
      assert.equal(lines().filter(t => t.startsWith("Couldn't check ")).length, 2);
      assert.equal(lines().some(t => t.includes("QA-KEY")), false);
      assert.notEqual(new WorktreeTable(desktop.context.database).find(KEY), null);
    });
  });

  describe("statusAsync and diffAsync", () => {
    test("read the key's worktree, its diff limited to the given paths", async () => {
      const record = await createAsync();
      await writeFile(path.join(record.path, "a.txt"), "changed\n");
      await writeFile(path.join(record.path, "new.txt"), "n\n");

      const status = await service.statusAsync(KEY);
      const diff = await service.diffAsync(KEY, new DiffScope(DiffScopeKind.Worktree));
      const limited = await service.diffAsync(KEY, new DiffScope(DiffScopeKind.Worktree), ["new.txt"]);

      assert.equal(status.branch, record.branch);
      assert.deepEqual(status.entries.map(t => t.path), ["a.txt", "new.txt"]);
      assert.deepEqual(diff.files.map(t => [t.path, t.change]), [["a.txt", FileChange.Modified], ["new.txt", FileChange.Added]]);
      assert.deepEqual(limited.files.map(t => t.path), ["new.txt"]);
    });

    test("refuse a key with no worktree", async () => {
      const missing = { ...failure("WorktreeMissingException", FailureCode.Refused), message: "No worktree belongs to this key. Create it first." };

      await assert.rejects(service.statusAsync(KEY), missing);
      await assert.rejects(service.diffAsync(KEY, new DiffScope(DiffScopeKind.Staged)), missing);
    });
  });

  test("fails a git error as Unavailable with a fixed message, and git's output beside it marked untrusted", async () => {
    const record = await createAsync();
    const elsewhere = path.join(repository.root, "elsewhere");
    await repository.runGitAsync(["worktree", "add", "--quiet", "--detach", elsewhere, record.base]);
    const admin = (await repository.runGitAsync(["-C", elsewhere, "rev-parse", "--absolute-git-dir"])).trim();
    await truncate(path.join(record.path, ".git"), 0);
    await appendFile(path.join(record.path, ".git"), `gitdir: ${admin}\n`);

    await assert.rejects(service.removeWorktreeAsync(KEY, { gate, context }), gitRefusal("worktree remove", /does not point back/v));

    assert.equal(await existsAsync(record.path), true);
  });
});
