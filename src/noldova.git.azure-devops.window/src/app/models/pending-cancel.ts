/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CompleteAction } from "../enums/complete-action.ts";

/** A write the Complete panel asks about that takes no merge type: cancelling auto-complete or abandoning the pull request. */
export class PendingCancel {
  public readonly action: CompleteAction.CancelAutoComplete | CompleteAction.Abandon;

  public constructor(action: CompleteAction.CancelAutoComplete | CompleteAction.Abandon) {
    this.action = action;
  }
}
