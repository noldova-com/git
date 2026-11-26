/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TabSize {
  public readonly size: number;
  public readonly hasMore: boolean;

  public constructor(size: number, hasMore: boolean) {
    this.size = size;
    this.hasMore = hasMore;
  }
}
