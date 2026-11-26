/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitPredictedLine {
  public readonly text: string;
  public readonly paths: readonly string[];
  public readonly more: number;

  public constructor(text: string, paths: readonly string[], more: number) {
    this.text = text;
    this.paths = paths;
    this.more = more;
  }
}
