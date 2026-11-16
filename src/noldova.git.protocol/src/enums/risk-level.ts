/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const RiskLevel = {
  Read: "Read",
  LocalReversible: "LocalReversible",
  Commit: "Commit",
  LocalDestructive: "LocalDestructive",
  Remote: "Remote"
} as const;

export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];
