/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RebaseStep } from "@noldova/git.protocol";

export class GitRebaseRowPlan {
  public readonly steps: readonly RebaseStep[];
  public readonly results: readonly string[];

  public constructor(steps: readonly RebaseStep[], results: readonly string[]) {
    this.steps = steps;
    this.results = results;
  }
}
