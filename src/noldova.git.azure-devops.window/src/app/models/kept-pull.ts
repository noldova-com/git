/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PullAfter } from "./pull-after.ts";

/** The pull the person asked for once a pull request merges, under the key of the pull request's reference. */
export class KeptPull {
  public readonly key: string;
  public readonly pull: PullAfter;

  public constructor(key: string, pull: PullAfter) {
    this.key = key;
    this.pull = pull;
  }
}
