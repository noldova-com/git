/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { WorkItemCategory } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { WorkItemChoice } from "../../../src/app/models/work-item-choice.ts";
import { WorkItemsPlace } from "../../../src/app/models/work-items-place.ts";
import { WorkItemSelection } from "../../../src/app/services/work-item-selection.ts";
import { detailOf, itemOf, story } from "../../fixtures/work-items-page.fixture.ts";

describe("WorkItemSelection", () => {
  it("keeps one Work item view per window", () => {
    const context = new FakeWindowPartContext();

    expect([WorkItemSelection.of(context) === WorkItemSelection.of(context), WorkItemSelection.of(context) === WorkItemSelection.of(new FakeWindowPartContext())])
      .toEqual([true, false]);
  });

  it("opens the Work item view's one instance, titled for the work item", () => {
    const context = new FakeWindowPartContext();
    const detail = detailOf(itemOf(7402, story, "Note sharing and sync", "Active", WorkItemCategory.InProgress, null));
    WorkItemSelection.of(context).showChosen(new WorkItemChoice(new WorkItemsPlace("fabrikam", "Sample Project", null), detail, []));

    expect(context.callsOf("openView")).toEqual([["git-azure-devops.workItemDetail", "selected", "Work item 7402"]]);
  });
});
