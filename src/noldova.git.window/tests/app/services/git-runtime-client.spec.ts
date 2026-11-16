/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { DiffScope, DiffScopeKind, FailureCode, GitBranches, GitDiff, GitFailure, GitHooks, GitStatus } from "@noldova/git.protocol";
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

  it("sends each write with the fingerprint it was based on, and watches and unwatches the folder", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.stage": null, "git.unstage": null, "git.createBranch": null, "git.switchBranch": null, "git.commit": null, "git.push": null, "git.pull": null
    });
    const client: GitRuntimeClient = new GitRuntimeClient(context);

    await client.stageAsync(folder, ["a.txt"], "f1");
    await client.unstageAsync(folder, ["b.txt"], "f2");
    await client.createBranchAsync(folder, "feature", "f3");
    await client.switchBranchAsync(folder, "main", "f4");
    await client.commitAsync(folder, "Fix it", "f5");
    await client.pushAsync(folder, "f6");
    await client.pullAsync(folder, "f7");
    await client.watchAsync(folder);
    await client.unwatchAsync(folder);

    expect(context.callsOf("requestAsync")).toEqual([
      ["git.stage", { folder, paths: ["a.txt"], basedOn: "f1" }],
      ["git.unstage", { folder, paths: ["b.txt"], basedOn: "f2" }],
      ["git.createBranch", { folder, name: "feature", basedOn: "f3" }],
      ["git.switchBranch", { folder, name: "main", basedOn: "f4" }],
      ["git.commit", { folder, message: "Fix it", basedOn: "f5" }],
      ["git.push", { folder, basedOn: "f6" }],
      ["git.pull", { folder, basedOn: "f7" }],
      ["git.watch", { folder }],
      ["git.unwatch", { folder }]
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
