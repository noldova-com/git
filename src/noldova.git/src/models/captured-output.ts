/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CapturedOutput {
  public readonly bytes: Buffer;
  public readonly isTruncated: boolean;

  public constructor(bytes: Buffer, isTruncated: boolean) {
    this.bytes = bytes;
    this.isTruncated = isTruncated;
  }
}
