/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitFileLine {
  public readonly path: string;
  public readonly line: number;

  public constructor(path: string, line: number) {
    this.path = path;
    this.line = line;
  }
}
