/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What a host module gives the Git view so that a new commit's message starts with its prefix for the branch, such as a work item's id. */
export interface IGitCommitPrefixes {
  /**
   * The prefix for a new commit's message on a branch of the repository at a folder, or null when the host has none for it.
   * The view reads it inside a computed signal, so a host that answers from signals fills the message once its answer arrives.
   */
  prefixFor(folder: string, branch: string): string | null;
}
