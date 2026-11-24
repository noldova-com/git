/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitEmptyState } from "../../../src/app/models/git-empty-state.ts";

describe("GitEmptyState", () => {
  it("keeps the icon, heading and text it was made with", () => {
    const state: GitEmptyState = new GitEmptyState("folder_off", "No repository", "Open a folder.");

    expect([state.icon, state.heading, state.text]).toEqual(["folder_off", "No repository", "Open a folder."]);
  });
});
