/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it, onTestFinished } from "vitest";

import { GitViewOptions } from "../../../src/app/services/git-view-options.ts";

describe("GitViewOptions", () => {
  it("starts with the branch card shown and the AI features off", () => {
    expect([GitViewOptions.showsBranch(), GitViewOptions.showsAiFeatures()]).toEqual([true, false]);
  });

  it("takes an app's choices", () => {
    onTestFinished(() => {
      GitViewOptions.showsBranch.set(true);
      GitViewOptions.showsAiFeatures.set(false);
    });

    GitViewOptions.showsBranch.set(false);
    GitViewOptions.showsAiFeatures.set(true);

    expect([GitViewOptions.showsBranch(), GitViewOptions.showsAiFeatures()]).toEqual([false, true]);
  });
});
