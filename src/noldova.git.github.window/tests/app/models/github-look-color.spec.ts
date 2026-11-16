/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitHubLookColor } from "../../../src/app/models/github-look-color.ts";

describe("GitHubLookColor", () => {
  it("holds a state's text and icon color and its badge's fill", () => {
    const color = new GitHubLookColor("#8250DF", "color-mix(in srgb, #8250DF 14%, transparent)");

    expect([color.color, color.background]).toEqual(["#8250DF", "color-mix(in srgb, #8250DF 14%, transparent)"]);
  });
});
