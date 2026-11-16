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

export class WorktreeBranchCheckedOutException extends GitFailureException {
  public override readonly code: FailureCode = FailureCode.Git;
  public override readonly gitCode: GitCode | null = GitCode.BranchCheckedOut;
  public override readonly output: IUntrustedText | null = null;
  public readonly branch: string;

  public constructor(branch: string) {
    super(Resources.formatWorktreeBranchCheckedOut(branch));

    this.branch = branch;
  }
}
