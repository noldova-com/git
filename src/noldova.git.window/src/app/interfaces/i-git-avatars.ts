/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What a host module gives the Git view so that commit authors show its pictures of them. */
export interface IGitAvatars {
  /**
   * Reads an author's picture in the repository at a folder, by the author's email and a commit of theirs.
   * Answers the picture as a data address, null when the host has none for them, or undefined while it is still reading.
   * The view reads it inside a computed signal, so a host that answers from signals shows the picture once it arrives.
   */
  avatarOf(folder: string, email: string, commitId: string): string | null | undefined;
}
