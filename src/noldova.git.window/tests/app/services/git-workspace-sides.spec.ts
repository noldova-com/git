/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, signal } from "@angular/core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitWorkspaceSide } from "../../../src/app/models/git-workspace-side.ts";
import { GitWorkspaceSides } from "../../../src/app/services/git-workspace-sides.ts";

describe("GitWorkspaceSides", () => {
  it("keeps one follower for each window and titles its view Workspaces whichever page it shows", () => {
    const context = new FakeWindowPartContext();
    const sides = GitWorkspaceSides.of(context);
    sides.showInFront(new GitWorkspaceSide(null, signal(null), computed(() => []), signal([]), () => undefined));

    expect([GitWorkspaceSides.of(context) === sides, GitWorkspaceSides.of(new FakeWindowPartContext()) === sides, context.callsOf("openView")])
      .toEqual([true, false, [["git.workspaces", "git.workspaces", "Workspaces"]]]);
  });
});
