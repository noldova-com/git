/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitResolvedFile {
  public readonly path: string;
  public readonly note: string;

  public constructor(path: string, note: string) {
    this.path = path;
    this.note = note;
  }
}
