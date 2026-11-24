/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** Which references `git.messageReferences` finds in commit messages. */
export const GitMessageReferenceKind = {
  AzureBoards: "AzureBoards"
} as const;

export type GitMessageReferenceKind = (typeof GitMessageReferenceKind)[keyof typeof GitMessageReferenceKind];
