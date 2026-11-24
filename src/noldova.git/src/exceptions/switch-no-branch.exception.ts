/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { FailureCode, type GitCode } from "@noldova/git.protocol";

import type { IUntrustedText } from "../interfaces/i-untrusted-text.ts";
import { Resources } from "../resources.ts";
import { GitFailureException } from "./git-failure.exception.ts";

/** A switch to a name no branch has, here or on a remote, which git would refuse after the person approved it. */
export class SwitchNoBranchException extends GitFailureException {
  public override readonly code: FailureCode = FailureCode.Refused;
  public override readonly gitCode: GitCode | null = null;
  public override readonly output: IUntrustedText | null = null;
  public readonly branch: string;

  public constructor(branch: string) {
    super(Resources.formatSwitchNoBranch(branch));
    this.branch = branch;
  }
}
