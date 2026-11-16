/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { FailureCode, GitCode } from "@noldova/git.protocol";

import type { IUntrustedText } from "../interfaces/i-untrusted-text.ts";
import { Resources } from "../resources.ts";
import { GitFailureException } from "./git-failure.exception.ts";

export class UnreadableOutputException extends GitFailureException {
  public override readonly code: FailureCode = FailureCode.Git;
  public override readonly gitCode: GitCode | null = GitCode.UnreadableOutput;
  public override readonly output: IUntrustedText | null = null;
  public readonly command: string;
  public readonly part: string;

  public constructor(command: string, part: string, cause?: unknown) {
    super(Resources.formatUnreadable(command, part), new ExceptionOptions(cause));

    this.command = command;
    this.part = part;
  }
}
