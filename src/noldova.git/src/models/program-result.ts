/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessExit } from "@noldova/desktop.runtime";

export class ProgramResult {
  public readonly exit: ProcessExit;
  public readonly output: Buffer;
  public readonly errors: Buffer;
  public readonly isTruncated: boolean;

  public constructor(exit: ProcessExit, output: Buffer, errors: Buffer, isTruncated: boolean) {
    this.exit = exit;
    this.output = output;
    this.errors = errors;
    this.isTruncated = isTruncated;
  }
}
