/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A line of a file in a pull request's latest push, such as a comment thread's, which the Files tab shows in the file's diff. */
export class GitFileLine {
  /** The file's path from the repository's root, such as `src/app.ts`. */
  public readonly path: string;
  /** The line's number in the file as the push leaves it, from 1. */
  public readonly line: number;

  public constructor(path: string, line: number) {
    this.path = path;
    this.line = line;
  }
}
