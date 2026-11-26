/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitDetailFront<T> {
  public readonly front: T | null | undefined;
  public readonly isFollowing: boolean;

  public constructor(front: T | null | undefined, isFollowing: boolean) {
    this.front = front;
    this.isFollowing = isFollowing;
  }
}
