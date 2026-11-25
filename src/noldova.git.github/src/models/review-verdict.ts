/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A review's state, such as approved, and the login of its author when the author is one whose review counts, or `null` otherwise. */
export class ReviewVerdict {
  public readonly login: string | null;
  public readonly state: string;

  public constructor(login: string | null, state: string) {
    this.login = login;
    this.state = state;
  }
}
