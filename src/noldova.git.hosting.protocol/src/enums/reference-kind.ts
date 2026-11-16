/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ReferenceKind = {
  PullRequest: "PullRequest",
  Issue: "Issue"
} as const;

export type ReferenceKind = (typeof ReferenceKind)[keyof typeof ReferenceKind];
