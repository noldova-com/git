/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitHistoryAsks } from "../../../src/app/services/git-history-asks.ts";
import { GitHistorySelection } from "../../../src/app/services/git-history-selection.ts";

describe("GitHistorySelection", () => {
  it("keeps the newest ask when an older one is taken, and drops an ask once it's taken", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("runCommandAsync", () => Promise.resolve(null));

    await GitHistorySelection.selectAsync(context, "/work/site", "a".repeat(40));
    const older = GitHistoryAsks.askedOf("/work/site");
    await GitHistorySelection.selectAsync(context, "/work/site", "b".repeat(40));
    if (older !== null)
      GitHistoryAsks.take(older);
    const newer = GitHistoryAsks.askedOf("/work/site");
    if (newer !== null)
      GitHistoryAsks.take(newer);

    expect([older?.commitId, newer?.commitId, GitHistoryAsks.askedOf("/work/site")]).toEqual(["a".repeat(40), "b".repeat(40), null]);
  });

  it("rejects as the command does, keeping the ask for when the history opens", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("runCommandAsync", () => Promise.reject(new Error("The Git module isn't active.")));

    const failure: unknown = await GitHistorySelection.selectAsync(context, "/work/site", "c".repeat(40)).then(() => null, (t: unknown) => t);
    const asked = GitHistoryAsks.askedOf("/work/site");
    if (asked !== null)
      GitHistoryAsks.take(asked);

    expect([failure instanceof Error ? failure.message : null, asked?.commitId]).toEqual(["The Git module isn't active.", "c".repeat(40)]);
  });
});
