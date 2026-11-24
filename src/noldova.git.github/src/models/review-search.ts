/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ReviewSearchAnswer } from "../types/review-search-answer.ts";

/** One search of the account's review requests: the token it ran with, when it started, and its answer, which callers share while it is held. */
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
