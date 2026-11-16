/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ReferenceState = {
  Open: "Open",
  Draft: "Draft",
  Merged: "Merged",
  Closed: "Closed",
  ClosedDone: "ClosedDone",
  ClosedNotPlanned: "ClosedNotPlanned"
} as const;

export type ReferenceState = (typeof ReferenceState)[keyof typeof ReferenceState];
