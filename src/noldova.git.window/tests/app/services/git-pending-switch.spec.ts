/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitPendingSwitch } from "../../../src/app/services/git-pending-switch.ts";

class Gate {
  public readonly promise: Promise<void>;
  public readonly resolve: () => void;

  public constructor(promise: Promise<void>, resolve: () => void) {
    this.promise = promise;
    this.resolve = resolve;
  }
}

describe("GitPendingSwitch", () => {
  const gate = (): Gate => {
    let open: () => void = () => undefined;
    const promise: Promise<void> = new Promise<void>(resolve => {
      open = resolve;
    });
    return new Gate(promise, () => open());
  };

  it("names the target branch for its folder only while the switch runs", async () => {
    const running = gate();
    const switching: Promise<void> = GitPendingSwitch.runAsync("/work/repo", "feature", () => running.promise);

    const during: readonly (string | null)[] = [GitPendingSwitch.branchOf("/work/repo"), GitPendingSwitch.branchOf("/work/other"), GitPendingSwitch.branchOf(null)];
    running.resolve();
    await switching;

    expect([during, GitPendingSwitch.branchOf("/work/repo")]).toEqual([["feature", null, null], null]);
  });

  it("forgets the target when the switch fails, and passes the failure on", async () => {
    const failed: Promise<void> = GitPendingSwitch.runAsync("/work/repo", "feature", () => Promise.reject(new Error("Changes in the way.")));

    await expect(failed).rejects.toThrow("Changes in the way.");
    expect(GitPendingSwitch.branchOf("/work/repo")).toBeNull();
  });

  it("keeps a newer switch's target when an older one ends", async () => {
    const older = gate();
    const newer = gate();
    const first: Promise<void> = GitPendingSwitch.runAsync("/work/repo", "old", () => older.promise);
    const second: Promise<void> = GitPendingSwitch.runAsync("/work/repo", "new", () => newer.promise);

    older.resolve();
    await first;
    const afterOlder: string | null = GitPendingSwitch.branchOf("/work/repo");
    newer.resolve();
    await second;

    expect([afterOlder, GitPendingSwitch.branchOf("/work/repo")]).toEqual(["new", null]);
  });
});
