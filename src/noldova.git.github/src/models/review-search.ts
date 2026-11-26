/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ReviewSearchAnswer } from "./review-search-answer.ts";

export class ReviewSearch {
  public readonly token: string;
  public readonly startedAt: number;
  public readonly answer: Promise<ReviewSearchAnswer>;

  public constructor(token: string, startedAt: number, answer: Promise<ReviewSearchAnswer>) {
    this.token = token;
    this.startedAt = startedAt;
    this.answer = answer;
  }
}
