/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ThreadLine {
  public readonly threadId: number;
  public readonly path: string;
  public readonly line: number;

  public constructor(threadId: number, path: string, line: number) {
    this.threadId = threadId;
    this.path = path;
    this.line = line;
  }
}
