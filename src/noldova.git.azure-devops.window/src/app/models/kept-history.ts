/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LinkedHistory } from "./linked-history.ts";

/** A repository's linked history, under the key of the folder and HEAD it was read at. */
export class KeptHistory {
  public readonly key: string;
  public readonly history: LinkedHistory;

  public constructor(key: string, history: LinkedHistory) {
    this.key = key;
    this.history = history;
  }
}
