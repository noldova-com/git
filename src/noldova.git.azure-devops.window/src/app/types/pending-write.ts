/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CompleteAction } from "../enums/complete-action.ts";
import type { MergeTypeChoice } from "./merge-type-choice.ts";

/** The write the Complete panel asks about: a merge with the merge type chosen when the person asked, or one that takes none. */
export type PendingWrite = { readonly action: CompleteAction.Complete | CompleteAction.SetAutoComplete; readonly mergeType: MergeTypeChoice }
  | { readonly action: CompleteAction.CancelAutoComplete | CompleteAction.Abandon };
