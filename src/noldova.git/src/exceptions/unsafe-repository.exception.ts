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

export class UnsafeRepositoryException extends GitFailureException {
  public override readonly code: FailureCode = FailureCode.NotRepository;
  public override readonly gitCode: GitCode | null = GitCode.UnsafeRepository;
  public override readonly output: IUntrustedText | null;
  public readonly folder: string;

  public constructor(folder: string, output: IUntrustedText) {
    super(Resources.formatUnsafeRepository(folder));

    this.folder = folder;
    this.output = output;
  }
}
