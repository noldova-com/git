/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode, type GitCode } from "@noldova/git.protocol";

import type { IUntrustedText } from "../interfaces/i-untrusted-text.ts";
import { GitFailureException } from "./git-failure.exception.ts";

export class CheckpointFailedException extends GitFailureException {
  public override readonly code: FailureCode = FailureCode.Unavailable;
  public override readonly gitCode: GitCode | null = null;
  public override readonly output: IUntrustedText | null = null;

  public constructor(message: string) {
    super(message);
  }
}
