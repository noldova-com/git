/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CompleteAction } from "../enums/complete-action.ts";
import type { MergeTypeChoice } from "./merge-type-choice.ts";

/** A write the Complete panel asks about that merges: completing the pull request or setting auto-complete, with the merge type chosen when the person asked. */
export class PendingMerge {
  public readonly action: CompleteAction.Complete | CompleteAction.SetAutoComplete;
  public readonly mergeType: MergeTypeChoice;

  public constructor(action: CompleteAction.Complete | CompleteAction.SetAutoComplete, mergeType: MergeTypeChoice) {
    this.action = action;
    this.mergeType = mergeType;
  }
}
