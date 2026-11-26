/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class QueriedIds {
  public readonly ids: readonly number[];
  public readonly isTruncated: boolean;

  public constructor(ids: readonly number[], isTruncated: boolean) {
    this.ids = ids;
    this.isTruncated = isTruncated;
  }
}
