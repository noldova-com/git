/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LinkPlace } from "@noldova/desktop.window";
import { describe, expect, it } from "vitest";

import { FailedLink } from "../../../src/app/models/failed-link.ts";

describe("FailedLink", () => {
  it("holds the link and the place it asked for, or none", () => {
    const system = new FailedLink("https://example.invalid/pull/1", LinkPlace.System);
    const unplaced = new FailedLink("https://example.invalid/pull/2", null);

    expect([system.url, system.place, unplaced.url, unplaced.place]).toEqual(["https://example.invalid/pull/1", LinkPlace.System, "https://example.invalid/pull/2", null]);
  });
});
