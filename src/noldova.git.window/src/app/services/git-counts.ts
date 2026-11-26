/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";

export class GitCounts {
  public static format(count: number): string {
    return Resources.formatCount(count);
  }

  public static formatStart(count: number): string {
    return Resources.formatCountStart(count);
  }
}
