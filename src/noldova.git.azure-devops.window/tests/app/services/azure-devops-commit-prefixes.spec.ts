/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitChanged, GitNames } from "@noldova/git.protocol";
import { GitCommitPrefixes } from "@noldova/git.window";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommitPrefixChoice } from "../../../src/app/models/commit-prefix-choice.ts";
import { AzureDevOpsCommitPrefixes } from "../../../src/app/services/azure-devops-commit-prefixes.ts";
import { BranchDialogData } from "../../fixtures/branch-dialog.fixture.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";

const KEY: string = "git-azure-devops.commitPrefixes";
const prefixes: AzureDevOpsCommitPrefixes = new AzureDevOpsCommitPrefixes();

function stored(): unknown {
  return JSON.parse(localStorage.getItem(KEY) ?? "null");
}

describe("AzureDevOpsCommitPrefixes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    AzureDevOpsCommitPrefixes.restore();
  });

  it("keeps a branch's prefix in the module's own storage, one per folder and branch, and drops it when asked", () => {
    AzureDevOpsCommitPrefixes.keep("/work/site", "users/ana/42-sign-in", 41);
    AzureDevOpsCommitPrefixes.keep("/work/site", "users/ana/42-sign-in", 42);
    AzureDevOpsCommitPrefixes.keep("/work/app", "users/ana/42-sign-in", 7);
    const kept = stored();
    AzureDevOpsCommitPrefixes.drop("/work/app", "users/ana/42-sign-in");
    AzureDevOpsCommitPrefixes.drop("/work/app", "main");

    expect(kept).toEqual([{ folder: "/work/site", branch: "users/ana/42-sign-in", id: 42 }, { folder: "/work/app", branch: "users/ana/42-sign-in", id: 7 }]);
    expect([prefixes.prefixFor("/work/site", "users/ana/42-sign-in"), prefixes.prefixFor("/work/app", "users/ana/42-sign-in"),
      prefixes.prefixFor("/work/site", "main"), stored()]).toEqual(["#42 ", null, null, [{ folder: "/work/site", branch: "users/ana/42-sign-in", id: 42 }]]);
  });

  it("reads back what it kept, leaves out what doesn't read, and starts empty from storage that isn't a list or isn't JSON", () => {
    localStorage.setItem(KEY, JSON.stringify([{ folder: "/work/site", branch: "users/ana/42-sign-in", id: 42 }, { folder: "", branch: "x", id: 1 }, "x"]));
    AzureDevOpsCommitPrefixes.restore();
    const restored = [prefixes.prefixFor("/work/site", "users/ana/42-sign-in"), prefixes.prefixFor("", "x")];
    const empty = ["{}", "{not json"].map(t => {
      localStorage.setItem(KEY, t);
      AzureDevOpsCommitPrefixes.restore();
      return prefixes.prefixFor("/work/site", "users/ana/42-sign-in");
    });

    expect([restored, empty]).toEqual([["#42 ", null], [null, null]]);
  });

  it("keeps the choice for the window's life when storage refuses it, and starts empty when storage can't be read", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full.", "QuotaExceededError");
    });
    AzureDevOpsCommitPrefixes.keep("/work/site", "main", 42);
    const kept = prefixes.prefixFor("/work/site", "main");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Denied.", "SecurityError");
    });
    AzureDevOpsCommitPrefixes.restore();

    expect([kept, prefixes.prefixFor("/work/site", "main")]).toEqual(["#42 ", null]);
  });

  it("passes on a failure that isn't storage's or JSON's", () => {
    const unexpected = new TypeError("Unexpected.");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw unexpected;
    });
    const saving = (): void => AzureDevOpsCommitPrefixes.keep("/work/site", "main", 42);
    const reading = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw unexpected;
    });
    const restoring = (): void => AzureDevOpsCommitPrefixes.restore();

    expect(saving).toThrow(unexpected);
    expect(restoring).toThrow(unexpected);
    reading.mockReturnValue(JSON.stringify([{ folder: "/work/site", branch: "main", id: 42 }]));
    vi.spyOn(CommitPrefixChoice, "fromJson").mockImplementation(() => {
      throw unexpected;
    });
    expect(restoring).toThrow(unexpected);
  });

  it("answers the Git view while provided, drops the choices of branches gone from a folder Git says changed, and forgets them when withdrawn",
    async () => {
      const context = new FakeWindowPartContext();
      const requests = new RequestAnswers(context);
      requests.answer(GitNames.branchesMethod, BranchDialogData.branchesOf("main", "users/ana/42-sign-in"), BranchDialogData.branchesOf("main", "users/ana/42-sign-in"));
      AzureDevOpsCommitPrefixes.keep("/work/site", "users/ana/42-sign-in", 42);
      AzureDevOpsCommitPrefixes.keep("/work/site", "users/ana/43-gone", 43);
      AzureDevOpsCommitPrefixes.keep("/work/app", "users/ana/43-gone", 43);
      const withdraw = AzureDevOpsCommitPrefixes.provide(context);
      const provided = ["users/ana/42-sign-in", "users/ana/43-gone"].map(t => GitCommitPrefixes.prefixFor("/work/site", t));

      context.raiseEvent(GitNames.changedEvent, new GitChanged("/work/elsewhere").toJson());
      context.raiseEvent(GitNames.changedEvent, new GitChanged("/work/site").toJson());
      await Wait.until(() => expect(prefixes.prefixFor("/work/site", "users/ana/43-gone")).toBeNull());
      const pruned = stored();
      context.raiseEvent(GitNames.changedEvent, new GitChanged("/work/site").toJson());
      await requests.askedAsync(2);
      withdraw();

      expect(provided).toEqual(["#42 ", "#43 "]);
      expect(pruned).toEqual([{ folder: "/work/site", branch: "users/ana/42-sign-in", id: 42 }, { folder: "/work/app", branch: "users/ana/43-gone", id: 43 }]);
      expect([requests.payloads, stored(), GitCommitPrefixes.prefixFor("/work/site", "users/ana/42-sign-in")]).toEqual([
        [{ folder: "/work/site" }, { folder: "/work/site" }], pruned, null]);
    });

  it("logs a change event it can't read and a branch read the window fails, keeping every choice", async () => {
    const context = new FakeWindowPartContext();
    const requests = new RequestAnswers(context);
    requests.fail(GitNames.branchesMethod, new WindowFailure("Not connected."));
    AzureDevOpsCommitPrefixes.keep("/work/site", "users/ana/43-gone", 43);
    const withdraw = AzureDevOpsCommitPrefixes.provide(context);

    context.raiseEvent(GitNames.changedEvent, { folder: 7 });
    context.raiseEvent(GitNames.changedEvent, new GitChanged("/work/site").toJson());
    await Wait.until(() => expect(context.callsOf("log")).toHaveLength(2));
    withdraw();

    expect(context.callsOf("log").map(t => t[0])).toEqual([expect.stringMatching(/^The Azure DevOps module's git\.changed event couldn't be read: /),
      "The Azure DevOps module's git.branches request failed: WindowFailure: Not connected."]);
    expect(stored()).toEqual([{ folder: "/work/site", branch: "users/ana/43-gone", id: 43 }]);
  });

  it("passes on a failure of the branch read or of the change event that isn't the window's or the protocol's", async () => {
    const context = new FakeWindowPartContext();
    const unexpected = new TypeError("Unexpected.");
    new RequestAnswers(context).fail(GitNames.branchesMethod, unexpected);
    AzureDevOpsCommitPrefixes.keep("/work/site", "main", 42);
    const withdraw = AzureDevOpsCommitPrefixes.provide(context);
    const pruning = AzureDevOpsCommitPrefixes.pruneAsync(context, "/work/site");
    vi.spyOn(GitChanged, "fromJson").mockImplementation(() => {
      throw unexpected;
    });
    const raising = (): void => context.raiseEvent(GitNames.changedEvent, new GitChanged("/work/site").toJson());

    expect(raising).toThrow(unexpected);
    await expect(pruning).rejects.toBe(unexpected);
    withdraw();
  });
});
