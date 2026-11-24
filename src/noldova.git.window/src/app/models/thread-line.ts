/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A comment thread on a line of a file, whose Go to line the person clicked. */
export class ThreadLine {
  /** The thread's id on its host. */
  public readonly threadId: number;
  /** The file's path as its host names it, such as Azure DevOps's `/src/app.ts` with a leading slash or GitHub's `src/app.ts`. */
  public readonly path: string;
  /** The line's number in the file, from 1. */
  public readonly line: number;

  public constructor(threadId: number, path: string, line: number) {
    this.threadId = threadId;
    this.path = path;
    this.line = line;
  }
}
