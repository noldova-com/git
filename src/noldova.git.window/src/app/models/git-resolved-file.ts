/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A file out of conflict that an operation conflicted on, with how the conflicts screen resolved it, or no note when it was resolved elsewhere. */
export class GitResolvedFile {
  public readonly path: string;
  public readonly note: string;

  public constructor(path: string, note: string) {
    this.path = path;
    this.note = note;
  }
}
