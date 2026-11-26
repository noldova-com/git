/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostReviewRequest } from "@noldova/git.hosting.protocol";

export class ReviewSearchAnswer {
  public readonly rows: readonly HostReviewRequest[];
  public readonly isCut: boolean;

  public constructor(rows: readonly HostReviewRequest[], isCut: boolean) {
    this.rows = rows;
    this.isCut = isCut;
  }
}
