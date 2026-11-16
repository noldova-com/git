/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitHubLook } from "../../../src/app/models/github-look.ts";
import { GitHubLookColor } from "../../../src/app/models/github-look-color.ts";

describe("GitHubLook", () => {
  it("holds the kind's and the state's labels, the icon and the colors in light and dark", () => {
    const light = new GitHubLookColor("#8250DF", "color-mix(in srgb, #8250DF 14%, transparent)");
    const dark = new GitHubLookColor("#A371F7", "color-mix(in srgb, #A371F7 18%, transparent)");

    const look = new GitHubLook("Pull request", "Merged", "data:image/svg+xml,a", light, dark);

    expect([look.kindLabel, look.stateLabel, look.icon, look.light, look.dark]).toEqual(["Pull request", "Merged", "data:image/svg+xml,a", light, dark]);
  });
});
