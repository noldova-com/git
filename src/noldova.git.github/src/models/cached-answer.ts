/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CachedAnswer {
  public readonly tag: string | null;
  public readonly body: string;
  public readonly readAt: number;

  public constructor(tag: string | null, body: string, readAt: number) {
    this.tag = tag;
    this.body = body;
    this.readAt = readAt;
  }

  public readAgainAt(readAt: number): CachedAnswer {
    return new CachedAnswer(this.tag, this.body, readAt);
  }
}
