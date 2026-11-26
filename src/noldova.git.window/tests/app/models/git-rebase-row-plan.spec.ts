/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RebaseAction, RebaseStep } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitRebaseRowPlan } from "../../../src/app/models/git-rebase-row-plan.ts";

describe("GitRebaseRowPlan", () => {
  it("holds the steps for git and the messages the kept commits end with", () => {
    const steps: readonly RebaseStep[] = [new RebaseStep("a".repeat(40), RebaseAction.Pick, null)];
    const value: GitRebaseRowPlan = new GitRebaseRowPlan(steps, ["Add a"]);

    expect([value.steps, value.results]).toEqual([steps, ["Add a"]]);
  });
});
