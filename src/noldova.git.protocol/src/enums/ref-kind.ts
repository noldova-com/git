/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What a label on a commit names: where HEAD points, a local branch, a remote's branch or a tag. */
export const RefKind = {
  Head: "Head",
  Branch: "Branch",
  RemoteBranch: "RemoteBranch",
  Tag: "Tag"
} as const;

export type RefKind = (typeof RefKind)[keyof typeof RefKind];
