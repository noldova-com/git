/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const RefKind = {
  Head: "Head",
  Branch: "Branch",
  RemoteBranch: "RemoteBranch",
  Tag: "Tag"
} as const;

export type RefKind = (typeof RefKind)[keyof typeof RefKind];
