/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRebasePlan } from "@noldova/git.protocol";

import type { GitRebaseTarget } from "../services/git-rebasing.ts";

export class GitRebaseStart {
  public readonly target: GitRebaseTarget;
  public readonly plan: GitRebasePlan;

  public constructor(target: GitRebaseTarget, plan: GitRebasePlan) {
    this.target = target;
    this.plan = plan;
  }
}
