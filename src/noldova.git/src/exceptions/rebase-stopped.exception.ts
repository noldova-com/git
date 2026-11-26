/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode, GitCode } from "@noldova/git.protocol";

import type { IUntrustedText } from "../interfaces/i-untrusted-text.ts";
import { Resources } from "../resources.ts";
import { GitFailureException } from "./git-failure.exception.ts";

export class RebaseStoppedException extends GitFailureException {
  public override readonly code: FailureCode = FailureCode.Git;
  public override readonly gitCode: GitCode | null = GitCode.Conflict;
  public override readonly output: IUntrustedText | null;

  public constructor(output: IUntrustedText) {
    super(Resources.rebaseStopped);
    this.output = output;
  }
}
