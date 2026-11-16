/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { UnreadableOutputException } from "../exceptions/unreadable-output.exception.ts";

export class Required {
  public static at<T>(items: ArrayLike<T | undefined>, index: number, command: string, part: string): T {
    const item: T | undefined = items[index];
    if (item === undefined)
      throw new UnreadableOutputException(command, part);
    return item;
  }

  public static bytes(value: unknown, command: string, part: string): Buffer {
    if (!Buffer.isBuffer(value))
      throw new UnreadableOutputException(command, part);
    return value;
  }
}
