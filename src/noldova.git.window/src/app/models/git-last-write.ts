/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
