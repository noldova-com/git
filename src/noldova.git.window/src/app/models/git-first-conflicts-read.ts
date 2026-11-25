/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PredictionAction } from "@noldova/git.protocol";

/** A read of which files an operation conflicted on when it began: the action that predicts them, and the key that tells one operation from the next. */
export class GitFirstConflictsRead {
  public readonly action: PredictionAction;
  /** The action and the commit it started from, which only the newest read's answer matches. */
  public readonly key: string;

  public constructor(action: PredictionAction, key: string) {
    this.action = action;
    this.key = key;
  }
}
