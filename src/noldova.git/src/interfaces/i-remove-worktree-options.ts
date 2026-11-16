/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICallContext } from "./i-call-context.ts";
import type { IPermissionGate } from "./i-permission-gate.ts";

export interface IRemoveWorktreeOptions {
  readonly context: ICallContext;
  readonly gate: IPermissionGate;
  readonly keepBranch?: boolean;
}
