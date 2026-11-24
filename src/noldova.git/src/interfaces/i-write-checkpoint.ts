/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The checkpoint a write took before it ran, with the paths an undo puts back from it. */
export interface IWriteCheckpoint {
  readonly id: string;
  readonly paths: readonly string[];
}
