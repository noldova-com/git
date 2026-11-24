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

/** A branch whose upstream on its remote has another name, which a push would update, as git's default push refuses too. */
export class PushUpstreamMismatchException extends GitFailureException {
  public override readonly code: FailureCode = FailureCode.Refused;
  public override readonly gitCode: GitCode | null = null;
  public override readonly output: IUntrustedText | null = null;
  public readonly branch: string;
  public readonly upstream: string;

  public constructor(branch: string, upstream: string) {
    super(Resources.formatPushUpstreamMismatch(branch, upstream));
    this.branch = branch;
    this.upstream = upstream;
  }
}
