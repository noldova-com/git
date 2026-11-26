/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CompleteAction } from "../enums/complete-action.ts";

export class PendingCancel {
  public readonly action: CompleteAction.CancelAutoComplete | CompleteAction.Abandon;

  public constructor(action: CompleteAction.CancelAutoComplete | CompleteAction.Abandon) {
    this.action = action;
  }
}
