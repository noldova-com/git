/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const OperationKind = {
  Merge: "Merge",
  Rebase: "Rebase",
  CherryPick: "CherryPick",
  Revert: "Revert"
} as const;

export type OperationKind = (typeof OperationKind)[keyof typeof OperationKind];
