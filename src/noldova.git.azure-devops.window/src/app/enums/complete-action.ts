/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What the Complete panel asks once before sending. */
export enum CompleteAction {
  /** Merges the pull request now. */
  Complete = "complete",
  /** Sets it to complete by itself once its policies pass. */
  SetAutoComplete = "setAutoComplete",
  /** Stops it from completing by itself. */
  CancelAutoComplete = "cancelAutoComplete",
  /** Closes it without merging. */
  Abandon = "abandon"
}
