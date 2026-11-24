/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/context.json";

/** The newest items of a list GitHub answers in pages, oldest first, and whether it has older ones they leave out. */
export class NewestItems {
  public readonly items: readonly JsonReader[];
  public readonly hasMore: boolean;

  public constructor(items: readonly JsonReader[], hasMore: boolean) {
    this.items = items;
    this.hasMore = hasMore;
  }
}
