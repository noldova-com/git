/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import {
  ConflictKind, ConflictResolution, DiffScope, DiffScopeKind, FailureCode, GitAvatar, GitBranches, GitBranchTrack, GitCommitSigning, GitConflict, GitDiff, GitFailure, GitHooks, GitJournal, GitMarkerCheck, GitPrediction, GitRebaseCheck, GitRebaseCommit, GitRebasePlan, GitRebaseStepCheck, GitRemoteTracks, GitStatus, OperationKind,
  PredictionAction, PredictionOutcome, RebaseAction, RebaseCheckOutcome, RebaseStep, SigningFormat
} from "@noldova/git.protocol";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitRuntimeClient } from "../../../src/app/services/git-runtime-client.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

class DetailedError extends Error {
  public readonly details: unknown;

  public constructor(details: unknown) {
    super("refused");
    this.details = details;
  }
}

describe("GitRuntimeClient", () => {
  const folder: string = "/work/project";

  it("reads the remote branches' counts against HEAD, and parses the answer", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const tracks: GitRemoteTracks = new GitRemoteTracks([new GitBranchTrack("origin/main", 1, 2)]);
    GitFixtures.answerWith(context, { "git.remoteTracks": tracks.toJson() });

    expect(await new GitRuntimeClient(context).remoteTracksAsync(folder)).toEqual(tracks);
    expect(context.callsOf("requestAsync")).toEqual([["git.remoteTracks", { folder }]]);
  });

  it("reads how the folder's repository signs commits, and parses the answer", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const signing: GitCommitSigning = new GitCommitSigning(true, SigningFormat.Ssh);
    GitFixtures.answerWith(context, { "git.commitSigning": signing.toJson() });

    expect(await new GitRuntimeClient(context).commitSigningAsync(folder)).toEqual(signing);
    expect(context.callsOf("requestAsync")).toEqual([["git.commitSigning", { folder }]]);
  });

  it("reads the status, branches and a diff of the folder, and parses each answer", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const status: GitStatus = new GitStatus("main", null, null, [], false, "f1", null, null);
    const branches: GitBranches = new GitBranches("main", ["main"], [], []);
    const diff: GitDiff = new GitDiff([], 0, 0, false);
    const hooks: GitHooks = new GitHooks(["post-merge"]);
    GitFixtures.answerWith(context, { "git.status": status.toJson(), "git.branches": branches.toJson(), "git.diff": diff.toJson(), "git.pullHooks": hooks.toJson() });
    const client: GitRuntimeClient = new GitRuntimeClient(context);

    expect(await client.statusAsync(folder)).toEqual(status);
    expect(await client.branchesAsync(folder)).toEqual(branches);
    expect(await client.diffAsync(folder, new DiffScope(DiffScopeKind.Staged))).toEqual(diff);
    expect(await client.pullHooksAsync(folder)).toEqual(hooks);
    expect(context.callsOf("requestAsync")).toEqual([
      ["git.status", { folder }],
      ["git.branches", { folder }],
      ["git.diff", { folder, scope: { kind: "Staged" } }],
      ["git.pullHooks", { folder }]
    ]);
  });

  it("reads an author's picture by their email, and parses the answer", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { "git.avatar": { image: "data:image/png;base64,QQ==" } });

    expect(await new GitRuntimeClient(context).avatarAsync("ana@example.com")).toEqual(new GitAvatar("data:image/png;base64,QQ=="));
    expect(context.callsOf("requestAsync")).toEqual([["git.avatar", { email: "ana@example.com" }]]);
  });

  it("sends a branch's rename and delete and a tag's create and delete with the fingerprint each was based on", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { "git.renameBranch": null, "git.deleteBranch": null, "git.createTag": null, "git.deleteTag": null });
    const client: GitRuntimeClient = new GitRuntimeClient(context);
    const id: string = "0123456789abcdef0123456789abcdef01234567";

    await client.renameBranchAsync(folder, "old", "new", "f1");
    await client.deleteBranchAsync(folder, "done", "f2");
    await client.createTagAsync(folder, "v1", id, "f3");
    await client.deleteTagAsync(folder, "v1", "f4");

    expect(context.callsOf("requestAsync")).toEqual([
      ["git.renameBranch", { folder, name: "old", newName: "new", basedOn: "f1" }],
      ["git.deleteBranch", { folder, name: "done", basedOn: "f2" }],
      ["git.createTag", { folder, name: "v1", id, basedOn: "f3" }],
      ["git.deleteTag", { folder, name: "v1", basedOn: "f4" }]
    ]);
  });

  it("sends each write with the fingerprint it was based on, and watches and unwatches the folder", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.stage": null, "git.unstage": null, "git.createBranch": null, "git.switchBranch": null, "git.commit": null, "git.push": null, "git.pull": null,
      "git.stageLines": null, "git.unstageLines": null, "git.discard": null, "git.undo": null, "git.forcePush": null, "git.fetch": null,
      "git.stash": null, "git.journal": new GitJournal([], true).toJson()
    });
    const client: GitRuntimeClient = new GitRuntimeClient(context);

    await client.stageAsync(folder, ["a.txt"], "f1");
    await client.unstageAsync(folder, ["b.txt"], "f2");
    await client.createBranchAsync(folder, "feature", "f3");
    await client.switchBranchAsync(folder, "main", "f4");
    await client.commitAsync(folder, "Fix it", "f5");
    await client.pushAsync(folder, "f6");
    await client.forcePushAsync(folder, "0123456789abcdef0123456789abcdef01234567", "f6");
    await client.fetchAsync(folder, "f6");
    await client.fetchAsync(folder, "f6", true);
    await client.stashAsync(folder, "Lanes", false, "f6");
    await client.stashAsync(folder, null, true, "f6");
    await client.pullAsync(folder, "f7");
    await client.stageLinesAsync(folder, "a.txt", [1, 2], "f8");
    await client.unstageLinesAsync(folder, "b.txt", [0], "f9");
    await client.discardAsync(folder, ["c.txt"], "f10");
    const journal: GitJournal = await client.journalAsync(folder);
    await client.undoAsync(folder, "7", "f11");
    await client.watchAsync(folder);
    await client.unwatchAsync(folder);

    expect(context.callsOf("requestAsync")).toEqual([
      ["git.stage", { folder, paths: ["a.txt"], basedOn: "f1" }],
      ["git.unstage", { folder, paths: ["b.txt"], basedOn: "f2" }],
      ["git.createBranch", { folder, name: "feature", basedOn: "f3" }],
      ["git.switchBranch", { folder, name: "main", basedOn: "f4" }],
      ["git.commit", { folder, message: "Fix it", basedOn: "f5" }],
      ["git.push", { folder, basedOn: "f6" }],
      ["git.forcePush", { folder, expected: "0123456789abcdef0123456789abcdef01234567", basedOn: "f6" }],
      ["git.fetch", { folder, basedOn: "f6" }],
      ["git.fetch", { folder, basedOn: "f6", allRemotes: true }],
      ["git.stash", { folder, message: "Lanes", includeUntracked: false, basedOn: "f6" }],
      ["git.stash", { folder, message: null, includeUntracked: true, basedOn: "f6" }],
      ["git.pull", { folder, basedOn: "f7" }],
      ["git.stageLines", { folder, path: "a.txt", lines: [1, 2], basedOn: "f8" }],
      ["git.unstageLines", { folder, path: "b.txt", lines: [0], basedOn: "f9" }],
      ["git.discard", { folder, paths: ["c.txt"], basedOn: "f10" }],
      ["git.journal", { folder }],
      ["git.undo", { folder, id: "7", basedOn: "f11" }],
      ["git.watch", { folder }],
      ["git.unwatch", { folder }]
    ]);
    expect(journal.checkpoints).toBe(true);
  });

  it("asks what a cherry-pick or a revert of a commit would do", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const prediction: GitPrediction = new GitPrediction(PredictionOutcome.Conflicts, ["a.txt"]);
    GitFixtures.answerWith(context, { "git.predict": prediction.toJson() });
    const client: GitRuntimeClient = new GitRuntimeClient(context);
    const id: string = "0123456789abcdef0123456789abcdef01234567";

    expect(await client.predictAsync(folder, id, PredictionAction.CherryPick)).toEqual(prediction);
    await client.predictAsync(folder, id, PredictionAction.Revert);

    expect(context.callsOf("requestAsync")).toEqual([
      ["git.predict", { folder, id, action: PredictionAction.CherryPick }],
      ["git.predict", { folder, id, action: PredictionAction.Revert }]
    ]);
  });

  it("reads a rebase's plan, checks its steps and starts it with the fingerprint it was based on", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const onto: string = "1".repeat(40);
    const id: string = "2".repeat(40);
    const plan: GitRebasePlan = new GitRebasePlan("feature", onto, onto, 0, [new GitRebaseCommit(id, "Add b", null)], [], false);
    const check: GitRebaseCheck = new GitRebaseCheck([new GitRebaseStepCheck(RebaseCheckOutcome.Clean, [])]);
    GitFixtures.answerWith(context, { "git.rebasePlan": plan.toJson(), "git.rebaseCheck": check.toJson(), "git.rebase": null });
    const client: GitRuntimeClient = new GitRuntimeClient(context);
    const steps: RebaseStep[] = [new RebaseStep(id, RebaseAction.Pick, null)];

    expect(await client.rebasePlanAsync(folder, onto)).toEqual(plan);
    expect(await client.rebaseCheckAsync(folder, onto, steps)).toEqual(check);
    await client.rebaseAsync(folder, onto, steps, true, "f1");

    const step = { id, action: RebaseAction.Pick, message: null };
    expect(context.callsOf("requestAsync")).toEqual([
      ["git.rebasePlan", { folder, onto }],
      ["git.rebaseCheck", { folder, onto, steps: [step] }],
      ["git.rebase", { folder, onto, steps: [step], updateRefs: true, basedOn: "f1" }]
    ]);
  });

  it("reads which files still have a conflict marker line", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { "git.markerCheck": new GitMarkerCheck(["a.txt"]).toJson() });

    expect([await new GitRuntimeClient(context).markerCheckAsync(folder), context.callsOf("requestAsync")]).toEqual([
      new GitMarkerCheck(["a.txt"]), [["git.markerCheck", { folder }]]
    ]);
  });

  it("reads a conflict and sends its resolution, a continue and an abort with the fingerprint they were based on", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const conflict: GitConflict = new GitConflict("a.txt", ConflictKind.BothModified, OperationKind.Merge, "b\n", "o\n", "t\n", "m\n", "main", "feature", null, null, false, false);
    GitFixtures.answerWith(context, { "git.conflict": conflict.toJson(), "git.resolveConflict": null, "git.continueOperation": null, "git.abortOperation": null });
    const client: GitRuntimeClient = new GitRuntimeClient(context);

    expect(await client.conflictAsync(folder, "a.txt")).toEqual(conflict);
    await client.resolveConflictAsync(folder, "a.txt", ConflictResolution.Text, "r\n", "f1");
    await client.resolveConflictAsync(folder, "b.txt", ConflictResolution.Delete, null, "f2");
    await client.continueOperationAsync(folder, "f3");
    await client.abortOperationAsync(folder, "f4");

    expect(context.callsOf("requestAsync")).toEqual([
      ["git.conflict", { folder, path: "a.txt" }],
      ["git.resolveConflict", { folder, path: "a.txt", resolution: "Text", text: "r\n", basedOn: "f1" }],
      ["git.resolveConflict", { folder, path: "b.txt", resolution: "Delete", text: null, basedOn: "f2" }],
      ["git.continueOperation", { folder, basedOn: "f3" }],
      ["git.abortOperation", { folder, basedOn: "f4" }]
    ]);
  });

  it("passes each changed folder to the listener until it stops listening, and logs a payload it can't read", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const changed: string[] = [];
    const stop: () => void = new GitRuntimeClient(context).onChanged(t => changed.push(t));

    context.raiseEvent("git.changed", { folder });
    context.raiseEvent("git.changed", { folder: "relative" });
    stop();
    context.raiseEvent("git.changed", { folder: "/work/other" });

    expect([changed, context.activeCallsOf("onEvent")]).toEqual([[folder], []]);
    expect(context.callsOf("log")).toEqual([
      ["The Git view ignored a change event it could not read: ProtocolFieldException: The field $.folder is invalid: expected an absolute path of at most 4096 characters."]
    ]);
  });

  it("reads git's failure from a failed call's details, and nothing from any other error", () => {
    const failure: GitFailure = new GitFailure(FailureCode.Stale, null, "The status moved.", null);

    expect(GitRuntimeClient.failureOf(new DetailedError(failure.toJson()))).toEqual(failure);
    expect(GitRuntimeClient.failureOf(new DetailedError(undefined))).toBeNull();
    expect(GitRuntimeClient.failureOf(new DetailedError({ code: "Lost", gitCode: null, message: "x" }))).toBeNull();
    expect(GitRuntimeClient.failureOf(new Error("lost"))).toBeNull();
    expect(GitRuntimeClient.failureOf("lost")).toBeNull();
  });

  it("counts the window's failures and an answer it can't read as a request's failure, and nothing else", () => {
    const unreadable: readonly unknown[] = [() => GitStatus.fromJson("lost"), () => GitStatus.fromJson({})].map(read => {
      try {
        read();
        return null;
      }
      catch (error) {
        return error;
      }
    });

    expect([GitFixtures.lost("The runtime stopped."), ...unreadable].map(t => GitRuntimeClient.isFailure(t))).toEqual([true, true, true]);
    expect([new TypeError("Not a function."), new DetailedError(null), "lost"].map(t => GitRuntimeClient.isFailure(t))).toEqual([false, false, false]);
  });

  it("lets an error other than an unreadable answer through while reading the details", () => {
    const details: object = {
      get code(): string {
        throw new RangeError("broken double");
      }
    };

    expect(() => GitRuntimeClient.failureOf(new DetailedError(details))).toThrow(RangeError);
  });

  it("lets an error other than an unreadable payload through a change event", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new GitRuntimeClient(context).onChanged(() => undefined);
    const payload: JsonValue = {
      get folder(): string {
        throw new RangeError("broken double");
      }
    };

    expect(() => context.raiseEvent("git.changed", payload)).toThrow(RangeError);
    expect(context.callsOf("log")).toEqual([]);
  });
});
