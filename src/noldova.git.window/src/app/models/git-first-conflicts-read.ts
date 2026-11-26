/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PredictionAction } from "@noldova/git.protocol";

export class GitFirstConflictsRead {
  public readonly action: PredictionAction;
  public readonly key: string;

  public constructor(action: PredictionAction, key: string) {
    this.action = action;
    this.key = key;
  }
}
