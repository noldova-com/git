/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A path's blob in the index, by its id and size in bytes. */
export class IndexBlob {
  public readonly id: string;
  public readonly size: number;

  public constructor(id: string, size: number) {
    this.id = id;
    this.size = size;
  }
}
