/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What a detail view's shown choice follows: the front document's choice, and whether any followed document is open. */
export class GitDetailFront<T> {
  /** The choice of the followed document in front: `undefined` while none is, `null` while it has nothing chosen. */
  public readonly front: T | null | undefined;
  public readonly isFollowing: boolean;

  public constructor(front: T | null | undefined, isFollowing: boolean) {
    this.front = front;
    this.isFollowing = isFollowing;
  }
}
