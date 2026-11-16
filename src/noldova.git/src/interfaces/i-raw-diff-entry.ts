/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FileChange } from "@noldova/git.protocol";

export interface IRawDiffEntry {
  readonly isCombined: boolean;
  readonly change: FileChange;
  readonly oldMode: string | null;
  readonly newMode: string | null;
  readonly oldId: string | null;
  readonly newId: string | null;
  readonly oldPath: Buffer;
  readonly path: Buffer;
}
