/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitHistoryAction } from "../../../src/app/enums/git-history-action.ts";
import { GitHistoryToolbar } from "../../../src/app/models/git-history-toolbar.ts";

describe("GitHistoryToolbar", () => {
  it("holds a toolbar's title and its actions", () => {
    const value: GitHistoryToolbar = new GitHistoryToolbar("Sync", [GitHistoryAction.Fetch, GitHistoryAction.Push]);

    expect([value.title, value.actions]).toEqual(["Sync", [GitHistoryAction.Fetch, GitHistoryAction.Push]]);
  });
});
