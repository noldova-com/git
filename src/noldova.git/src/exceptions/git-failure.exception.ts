/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";
import type { FailureCode, GitCode } from "@noldova/git.protocol";

import type { IUntrustedText } from "../interfaces/i-untrusted-text.ts";
import { GitException } from "./git.exception.ts";

export abstract class GitFailureException extends GitException {
  public abstract readonly code: FailureCode;
  public abstract readonly gitCode: GitCode | null;
  public abstract readonly output: IUntrustedText | null;

  protected constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }
}
