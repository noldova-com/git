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

export class SwitchRemoteAmbiguousException extends GitFailureException {
  public override readonly code: FailureCode = FailureCode.Refused;
  public override readonly gitCode: GitCode | null = null;
  public override readonly output: IUntrustedText | null = null;
  public readonly branch: string;
  public readonly remotes: readonly string[];

  public constructor(branch: string, remotes: readonly string[]) {
    super(Resources.formatSwitchRemoteAmbiguous(branch, remotes));
    this.branch = branch;
    this.remotes = remotes;
  }
}
