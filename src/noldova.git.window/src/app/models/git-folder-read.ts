/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitFolderRead {
  public readonly folder: string | null;
  public readonly failure: string | null;

  public constructor(folder: string | null, failure: string | null) {
    this.folder = folder;
    this.failure = failure;
  }
}
