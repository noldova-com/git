/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RemoveWorktreeRequest } from "../models/remove-worktree-request.ts";

export interface IPermissionGate {
  requestAsync(request: RemoveWorktreeRequest, signal?: AbortSignal): Promise<void>;
}
