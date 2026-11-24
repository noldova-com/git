/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitConflictDetail } from "../../../src/app/models/git-conflict-detail.ts";
import { GitConflictDetails } from "../../../src/app/services/git-conflict-details.ts";
import type { GitDetailView } from "../../../src/app/services/git-detail-view.ts";

describe("GitConflictDetails", () => {
  const detail: GitConflictDetail = new GitConflictDetail(null, null, [], null);

  it("keeps one Conflict view for each window, and another for another window", () => {
    const first: FakeWindowPartContext = new FakeWindowPartContext();
    const second: FakeWindowPartContext = new FakeWindowPartContext();

    expect([GitConflictDetails.of(first) === GitConflictDetails.of(first), GitConflictDetails.of(first) === GitConflictDetails.of(second)]).toEqual([true, false]);
  });

  it("opens the window's Conflict view as its one instance titled Conflict, once, and again only once the person closed it", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const details: GitDetailView<GitConflictDetail> = GitConflictDetails.of(context);
    const stop: () => void = details.listen();

    details.showOnce(detail);
    details.showChosen(detail);
    context.raiseViewClosed("git.conflictDetail", "another");
    details.showChosen(detail);
    context.raiseViewClosed("git.conflictDetail", "selected");
    details.showChosen(detail);
    stop();

    expect([context.callsOf("openView"), context.callsOf("showView")])
      .toEqual([[["git.conflictDetail", "selected", "Conflict"], ["git.conflictDetail", "selected", "Conflict"]], []]);
  });
});
