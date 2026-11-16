/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DiffFile } from "@noldova/git.protocol";

export class ParsedDiff {
  public readonly files: readonly DiffFile[];
  public readonly omittedFiles: number;
  public readonly isCut: boolean;

  public constructor(files: readonly DiffFile[], omittedFiles: number, isCut: boolean) {
    this.files = files;
    this.omittedFiles = omittedFiles;
    this.isCut = isCut;
  }
}
