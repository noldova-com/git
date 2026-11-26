/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FailureCode, GitNames, type GitJournalEntry, RebaseAction, RebaseStep, ResetMode, UndoMode } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { UndoDuringOperationException } from "../../src/exceptions/undo-during-operation.exception.ts";
import { UndoMovedException } from "../../src/exceptions/undo-moved.exception.ts";
import { UndoNotPossibleException } from "../../src/exceptions/undo-not-possible.exception.ts";
import { UndoBranchCheckedOutException } from "../../src/exceptions/undo-branch-checked-out.exception.ts";
import { UndoOtherWorktreeException } from "../../src/exceptions/undo-other-worktree.exception.ts";
import { UndoUnknownException } from "../../src/exceptions/undo-unknown.exception.ts";
import type { IGitWrite } from "../../src/interfaces/i-git-write.ts";
import { RefSnapshot } from "../../src/models/ref-snapshot.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { BranchAtWriter } from "../../src/services/branch-at.writer.ts";
import { BranchCreateWriter } from "../../src/services/branch-create.writer.ts";
import { BranchSwitchWriter } from "../../src/services/branch-switch.writer.ts";
import { CheckoutRisksReader } from "../../src/services/checkout-risks.reader.ts";
import { CheckpointStore } from "../../src/services/checkpoint-store.ts";
import { CommitWriter } from "../../src/services/commit.writer.ts";
import { DiscardWriter } from "../../src/services/discard.writer.ts";
import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { Journal } from "../../src/services/journal.ts";
import { PickWriter } from "../../src/services/pick.writer.ts";
import { RebaseWriter } from "../../src/services/rebase.writer.ts";
import { RefWriter } from "../../src/services/ref.writer.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RefSnapshotReader } from "../../src/services/ref-snapshot.reader.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { ResetWriter } from "../../src/services/reset.writer.ts";
import { SessionBranches } from "../../src/services/session-branches.ts";
import { StageWriter } from "../../src/services/stage.writer.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { UndoWriter } from "../../src/services/undo.writer.ts";
import { WriteRunner } from "../../src/services/write.runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { FakeCheckpoints } from "../fixtures/fake-checkpoints.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("UndoWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let statuses: StatusReader;
  let snapshots: RefSnapshotReader;
  let hooks: HooksReader;
  let filters: FilterOptionsReader;
  let journal: Journal;
  let writes: WriteRunner;
  let folders: RepositoryFolders;
  let checkpoints: FakeCheckpoints | null;
  const store: CheckpointStore = new CheckpointStore(() => checkpoints);

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["switch", "--quiet", "--create", "side"]);
    await template.writeAsync("b.txt", "side\n");
    await template.runGitAsync(["add", "b.txt"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Add b"]);
    await template.writeAsync("a.txt", "side a\n");
    await template.runGitAsync(["commit", "--quiet", "-am", "Change a on side"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new ProgramRunner(supervisor.context);
    statuses = new StatusReader(runner);
    snapshots = new RefSnapshotReader(runner);
    hooks = new HooksReader(runner);
    filters = new FilterOptionsReader(runner);
    journal = new Journal();
    checkpoints = new FakeCheckpoints();
    writes = new WriteRunner(statuses, snapshots, journal, () => undefined, () => undefined);
    folders = await new RepositoryReader(runner, new GitVersionReader(runner)).readAsync(repository.folder);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const idOf = async (revision: string): Promise<string> => (await repository.runGitAsync(["rev-parse", revision])).trim();
  const statusOf = async (): Promise<string> => await repository.runGitAsync(["status", "--porcelain=v1"]);
  const branchOf = async (): Promise<string> => (await repository.runGitAsync(["branch", "--show-current"])).trim();
  const writeAsync = async (write: IGitWrite): Promise<GitJournalEntry> => {
    await writes.runAsync(folders, (await statuses.readAsync(folders)).fingerprint, write, null);
    const entries = journal.read(folders.commonGitFolder).entries;
    const entry = entries.at(-1);
    assert.ok(entry !== undefined);
    return entry;
  };
  const undoAsync = async (entry: GitJournalEntry): Promise<void> => {
    await writes.runAsync(folders, (await statuses.readAsync(folders)).fingerprint, new UndoWriter(runner, snapshots, journal, store, entry.id), null);
  };
  const refusedAsync = async (running: Promise<void>, type: abstract new (...args: never[]) => GitFailureException, code: FailureCode): Promise<void> => {
    await assert.rejects(running, (error: unknown) => error instanceof type && error.code === code);
  };
  const commitAsync = async (file: string): Promise<GitJournalEntry> => {
    await repository.writeAsync(file, `${file}\n`);
    await repository.runGitAsync(["add", file]);
    return await writeAsync(new CommitWriter(runner, hooks, `Add ${file}`));
  };

  test("undoes a commit by moving the branch back with its changes still staged, and calls a second undo of the same entry unknown", async () => {
    const first = await idOf("HEAD");
    const commit = await commitAsync("c.txt");

    await undoAsync(commit);

    assert.deepEqual([await idOf("HEAD"), await statusOf()], [first, "A  c.txt\n"]);
    await refusedAsync(undoAsync(commit), UndoUnknownException, FailureCode.Stale);
  });

  test("undoes staging by putting the index's tree back, and refuses once the index has changed since", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    const stage = await writeAsync(new StageWriter(runner, hooks, filters, ["a.txt"]));
    assert.equal(stage.undo, UndoMode.Index);

    await undoAsync(stage);
    assert.equal(await statusOf(), " M a.txt\n");

    const again = await writeAsync(new StageWriter(runner, hooks, filters, ["a.txt"]));
    await repository.writeAsync("c.txt", "c\n");
    await repository.runGitAsync(["add", "c.txt"]);
    await refusedAsync(undoAsync(again), UndoMovedException, FailureCode.Stale);
  });

  test("undoes a branch made and switched to by switching back and deleting it, and a branch made at a commit by deleting it", async () => {
    const created = await writeAsync(new BranchCreateWriter(runner, hooks, "feature", new SessionBranches(), null));
    assert.equal(await branchOf(), "feature");

    await undoAsync(created);
    assert.equal(await branchOf(), "main");
    assert.equal(await repository.runGitAsync(["branch", "--list", "feature"]), "");

    const at = await writeAsync(new BranchAtWriter(runner, "at-side", await idOf("side")));
    await undoAsync(at);
    assert.equal(await repository.runGitAsync(["branch", "--list", "at-side"]), "");
  });

  test("undoes a cherry-pick by resetting back keeping local changes, and a mixed reset by resetting forward with its index", async () => {
    const first = await idOf("HEAD");
    const pick = await writeAsync(new PickWriter(runner, hooks, GitNames.cherryPickMethod, await idOf("side~1")));
    await repository.writeAsync("a.txt", "local\n");

    await undoAsync(pick);
    assert.deepEqual([await idOf("HEAD"), await statusOf()], [first, " M a.txt\n"]);

    await repository.runGitAsync(["checkout", "--", "a.txt"]);
    const second = await commitAsync("c.txt");
    const reset = await writeAsync(new ResetWriter(runner, ResetMode.Mixed, first));
    assert.equal(await statusOf(), "?? c.txt\n");
    await undoAsync(reset);
    assert.deepEqual([await idOf("HEAD"), await statusOf()], [second.moves[0]?.after, ""]);
  });

  test("undoes a finished interactive rebase by putting the branch and the stacked branch it moved back at their old tips", async () => {
    await repository.runGitAsync(["switch", "--quiet", "side"]);
    await repository.runGitAsync(["branch", "stacked", "side~1"]);
    const tip = await idOf("side");
    const stacked = await idOf("stacked");
    const steps = [new RebaseStep(stacked, RebaseAction.Reword, "Add b, reworded"), new RebaseStep(tip, RebaseAction.Pick, null)];
    const rebase = await writeAsync(new RebaseWriter(runner, hooks, await idOf("main"), steps, true));
    assert.deepEqual([rebase.undo, await idOf("side") === tip, await idOf("stacked") === stacked], [UndoMode.Keep, false, false]);

    await undoAsync(rebase);

    assert.deepEqual([await branchOf(), await idOf("side"), await idOf("stacked"), await statusOf()], ["side", tip, stacked, ""]);
  });

  test("undoes a commit on a detached HEAD by moving HEAD itself back, and a switch from a detached HEAD by detaching it again", async () => {
    const first = await idOf("HEAD");
    await repository.runGitAsync(["switch", "--quiet", "--detach", "side"]);
    const side = await idOf("HEAD");
    const commit = await commitAsync("c.txt");
    assert.deepEqual(commit.moves.map(t => t.name), ["HEAD"]);

    await undoAsync(commit);
    assert.deepEqual([await idOf("HEAD"), await branchOf()], [side, ""]);

    await repository.runGitAsync(["reset", "--quiet", "--hard"]);
    const away = await writeAsync(new BranchSwitchWriter(runner, new CheckoutRisksReader(hooks, filters), "main"));
    await undoAsync(away);
    assert.deepEqual([await idOf("HEAD"), await branchOf()], [side, ""]);

    await repository.runGitAsync(["switch", "--quiet", "--detach", "main"]);
    const same = await writeAsync(new BranchSwitchWriter(runner, new CheckoutRisksReader(hooks, filters), "main"));
    assert.deepEqual(same.moves, []);
    await undoAsync(same);
    assert.deepEqual([await idOf("HEAD"), await branchOf()], [first, ""]);

    const pick = await writeAsync(new PickWriter(runner, hooks, GitNames.cherryPickMethod, await idOf("side~1")));
    assert.deepEqual([pick.undo, pick.moves.map(t => t.name)], [UndoMode.Keep, ["HEAD"]]);
    await undoAsync(pick);
    assert.deepEqual([await idOf("HEAD"), await branchOf()], [first, ""]);
  });

  test("refuses a write that can't be undone, an entry whose branch is checked out no more, and any undo while a cherry-pick stops on a conflict", async () => {
    const now = await snapshots.readAsync(folders, false);
    const none = journal.record(folders.commonGitFolder, folders.gitFolder, GitNames.pushMethod, UndoMode.None, now, now);
    await refusedAsync(undoAsync(none), UndoNotPossibleException, FailureCode.Refused);

    const commit = await commitAsync("c.txt");
    await repository.runGitAsync(["switch", "--quiet", "side"]);
    await refusedAsync(undoAsync(commit), UndoMovedException, FailureCode.Stale);

    await repository.runGitAsync(["switch", "--quiet", "main"]);
    await repository.writeAsync("a.txt", "main a\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Change a on main"]);
    await repository.runGitAsync(["cherry-pick", "side"]).catch(() => undefined);
    await refusedAsync(undoAsync(commit), UndoDuringOperationException, FailureCode.Refused);
  });

  test("refuses to reset back to a branch that had no commit, or to switch back to a HEAD that had none", async () => {
    const head = await idOf("HEAD");
    const now = await snapshots.readAsync(folders, false);
    const unborn = new RefSnapshot("main", null, new Map([...now.refs].filter(([name]) => name !== "refs/heads/main")), null);
    const kept = journal.record(folders.commonGitFolder, folders.gitFolder, GitNames.pullMethod, UndoMode.Keep, unborn, now);
    assert.deepEqual(kept.moves.map(t => [t.name, t.before, t.after]), [["refs/heads/main", null, head]]);
    await refusedAsync(undoAsync(kept), UndoNotPossibleException, FailureCode.Refused);
    const unmoved = journal.record(folders.commonGitFolder, folders.gitFolder, GitNames.pullMethod, UndoMode.Mixed, now, now);
    await refusedAsync(undoAsync(unmoved), UndoNotPossibleException, FailureCode.Refused);

    await repository.runGitAsync(["switch", "--quiet", "--orphan", "fresh"]);
    const orphan = await snapshots.readAsync(folders, false);
    const detached = new RefSnapshot(null, null, orphan.refs, null);
    const switched = journal.record(folders.commonGitFolder, folders.gitFolder, GitNames.switchBranchMethod, UndoMode.Switch, detached, orphan);
    await refusedAsync(undoAsync(switched), UndoNotPossibleException, FailureCode.Refused);
  });

  test("undoes a write that deleted a ref by making it again, and passes on git's failure to put the index back", async () => {
    await repository.runGitAsync(["tag", "gone"]);
    const tagged = await snapshots.readAsync(folders, true);
    await repository.runGitAsync(["tag", "--delete", "gone"]);
    const deleted = journal.record(folders.commonGitFolder, folders.gitFolder, GitNames.resetMethod, UndoMode.Refs, tagged, await snapshots.readAsync(folders, true));

    await undoAsync(deleted);

    assert.equal(await idOf("refs/tags/gone"), await idOf("HEAD"));
    const now = await snapshots.readAsync(folders, true);
    const missing = new RefSnapshot(now.branch, now.head, now.refs, "0".repeat(40));
    const staged = journal.record(folders.commonGitFolder, folders.gitFolder, GitNames.stageMethod, UndoMode.Index, missing, now);
    await refusedAsync(undoAsync(staged), GitFailedException, FailureCode.Unavailable);
  });

  test("undoes a rename of the checked-out branch by renaming it back, so HEAD and its upstream follow it", async () => {
    await repository.runGitAsync(["config", "branch.main.remote", "origin"]);
    const renamed = await writeAsync(new RefWriter(runner, GitNames.renameBranchMethod, ["branch", "--move", "main", "trunk"], "branch", null));
    assert.equal(await branchOf(), "trunk");

    await undoAsync(renamed);

    assert.equal(await branchOf(), "main");
    assert.equal((await repository.runGitAsync(["config", "branch.main.remote"])).trim(), "origin");
    assert.equal((await repository.runGitAsync(["branch", "--list", "trunk"])).trim(), "");
    assert.equal(await statusOf(), "");
  });

  test("puts the refs back when a rename's entry moved no branch to rename back", async () => {
    const before = await snapshots.readAsync(folders, true);
    await repository.runGitAsync(["tag", "made"]);
    const entry = journal.record(folders.commonGitFolder, folders.gitFolder, GitNames.renameBranchMethod, UndoMode.Refs, before, await snapshots.readAsync(folders, true));

    await undoAsync(entry);

    assert.equal((await repository.runGitAsync(["tag", "--list", "made"])).trim(), "");
  });

  test("tells an agent's undo of a deleted branch that its settings don't come back", async () => {
    await repository.runGitAsync(["branch", "spare"]);
    const deleted = await writeAsync(new RefWriter(runner, GitNames.deleteBranchMethod, ["branch", "-d", "spare"], "branch", null));
    const request = await new UndoWriter(runner, snapshots, journal, store, deleted.id).requestAsync(folders, await statuses.readAsync(folders), null);

    assert.deepEqual(request?.details.at(-1), { label: "Note", kind: PermissionDetailKind.Text,
      value: "The branch comes back at its commit, but its upstream and other settings were removed with it and don't come back." });
  });

  test("asks an agent's undo as High risk, once, naming the method and each ref it puts back", async () => {
    const first = await idOf("HEAD");
    const commit = await commitAsync("c.txt");
    const request = await new UndoWriter(runner, snapshots, journal, store, commit.id).requestAsync(folders, await statuses.readAsync(folders), null);
    const after = await idOf("HEAD");

    assert.deepEqual(request, {
      action: GitNames.undoMethod,
      subject: folders.top,
      title: "Undo git.commit",
      details: [{ label: "Refs", kind: PermissionDetailKind.Code, value: `refs/heads/main ${after.slice(0, 7)} to ${first.slice(0, 7)}` }],
      risk: ToolRisk.High,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    });
  });

  test("undoes a discard by putting only its paths back from the checkpoint taken before it, leaving later changes elsewhere", async () => {
    await repository.writeAsync("a.txt", "edited\n");
    await repository.writeAsync("new.txt", "new\n");
    const discard = await writeAsync(new DiscardWriter(runner, ["a.txt", "new.txt"], store));
    const discarded = await statusOf();
    await repository.writeAsync("b.txt", "later\n");
    const fake = checkpoints;
    assert.ok(fake !== null);
    fake.onRestore = async () => {
      await repository.writeAsync("a.txt", "edited\n");
      await repository.writeAsync("new.txt", "new\n");
    };

    await undoAsync(discard);

    assert.deepEqual([discard.undo, discard.checkpoint, discard.paths, discarded], [UndoMode.Checkpoint, FakeCheckpoints.id, ["a.txt", "new.txt"], ""]);
    assert.deepEqual(fake.previews.map(t => [t.checkpoint, t.paths, t.folder.path]), [[FakeCheckpoints.id, ["a.txt", "new.txt"], folders.top]]);
    assert.deepEqual([await statusOf(), journal.find(folders.commonGitFolder, discard.id)], [" M a.txt\n?? b.txt\n?? new.txt\n", null]);
  });

  test("can't undo a discard once the checkpoints module is off, and keeps its entry", async () => {
    await repository.writeAsync("a.txt", "edited\n");
    const discard = await writeAsync(new DiscardWriter(runner, ["a.txt"], store));
    checkpoints = null;

    await refusedAsync(undoAsync(discard), UndoNotPossibleException, FailureCode.Refused);

    assert.equal(journal.find(folders.commonGitFolder, discard.id)?.id, discard.id);
  });

  test("asks an agent's undo of a discard naming the paths it puts back", async () => {
    await repository.writeAsync("a.txt", "edited\n");
    const discard = await writeAsync(new DiscardWriter(runner, ["a.txt"], store));

    const request = await new UndoWriter(runner, snapshots, journal, store, discard.id).requestAsync(folders, await statuses.readAsync(folders), null);

    assert.deepEqual(request?.details, [{ label: "Paths", kind: PermissionDetailKind.Code, value: "a.txt" }]);
  });

  test("undoes a write that moved HEAD only in its own worktree, though another worktree of the repository is detached at the same commit, and a branch made at a commit from either", async () => {
    await repository.runGitAsync(["switch", "--quiet", "--detach"]);
    const other = path.join(path.dirname(repository.folder), "other");
    await repository.runGitAsync(["worktree", "add", "--quiet", "--detach", other, "HEAD"]);
    const otherFolders = await new RepositoryReader(runner, new GitVersionReader(runner)).readAsync(other);
    const commit = await commitAsync("c.txt");
    const made = await idOf("HEAD");
    await repository.runGitAsync(["-C", other, "switch", "--quiet", "--detach", made]);
    const at = await writeAsync(new BranchAtWriter(runner, "at-side", await idOf("side")));
    const undoInAsync = async (where: RepositoryFolders, entry: GitJournalEntry): Promise<void> => {
      await writes.runAsync(where, (await statuses.readAsync(where)).fingerprint, new UndoWriter(runner, snapshots, journal, store, entry.id), null);
    };

    await refusedAsync(undoInAsync(otherFolders, commit), UndoOtherWorktreeException, FailureCode.Refused);
    const heads = [(await repository.runGitAsync(["-C", other, "rev-parse", "HEAD"])).trim(), await idOf("HEAD")];
    await undoInAsync(otherFolders, at);
    await undoAsync(commit);

    assert.deepEqual([heads, await repository.runGitAsync(["branch", "--list", "at-side"]), (await repository.runGitAsync(["-C", other, "rev-parse", "HEAD"])).trim(), await statusOf()],
      [[made, made], "", made, "A  c.txt\n"]);
  });

  test("refuses to undo a branch one worktree made at a commit while another has it checked out, naming that worktree, and undoes it once that worktree has left it", async () => {
    const other = path.join(path.dirname(repository.folder), "other");
    await repository.runGitAsync(["worktree", "add", "--quiet", "--detach", other, "HEAD"]);
    const otherFolders = await new RepositoryReader(runner, new GitVersionReader(runner)).readAsync(other);
    await writes.runAsync(otherFolders, (await statuses.readAsync(otherFolders)).fingerprint, new BranchAtWriter(runner, "side-copy", await idOf("HEAD")), null);
    const made = journal.read(otherFolders.commonGitFolder).entries.at(-1);
    assert.ok(made !== undefined);
    await repository.runGitAsync(["switch", "--quiet", "side-copy"]);
    const undoInOtherAsync = async (): Promise<void> => {
      await writes.runAsync(otherFolders, (await statuses.readAsync(otherFolders)).fingerprint, new UndoWriter(runner, snapshots, journal, store, made.id), null);
    };

    const refusal: unknown = await undoInOtherAsync().then(() => null, (error: unknown) => error);
    const kept = await repository.runGitAsync(["branch", "--list", "side-copy"]);
    await repository.runGitAsync(["switch", "--quiet", "main"]);
    await undoInOtherAsync();

    assert.ok(refusal instanceof UndoBranchCheckedOutException);
    assert.deepEqual([refusal.branch, await realpath(refusal.worktree), refusal.code, kept, await repository.runGitAsync(["branch", "--list", "side-copy"])],
      ["side-copy", await realpath(repository.folder), FailureCode.Refused, "* side-copy\n", ""]);
  });
});
