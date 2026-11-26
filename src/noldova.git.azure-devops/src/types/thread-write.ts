/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ThreadStatus } from "@noldova/git.hosting.protocol";

export type ThreadWrite = typeof ThreadStatus.Active | typeof ThreadStatus.Resolved;
