/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const LineKind = {
  Context: "Context",
  Added: "Added",
  Removed: "Removed",
  NoNewlineAtEnd: "NoNewlineAtEnd"
} as const;

export type LineKind = (typeof LineKind)[keyof typeof LineKind];
