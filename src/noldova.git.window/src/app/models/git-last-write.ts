/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The newest write of a repository's journal that can be undone, with the status it was read with, which the undo is based on. */
export class GitLastWrite {
  public readonly folder: string;
  public readonly id: string;
  public readonly fingerprint: string;

  public constructor(folder: string, id: string, fingerprint: string) {
    this.folder = folder;
    this.id = id;
    this.fingerprint = fingerprint;
  }
}
