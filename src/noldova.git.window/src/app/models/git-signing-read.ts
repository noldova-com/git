/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitCommitSigning } from "@noldova/git.protocol";

/** A signing read's answer and the folder it is for. */
export class GitSigningRead {
  public readonly folder: string;
  public readonly signing: GitCommitSigning;

  public constructor(folder: string, signing: GitCommitSigning) {
    this.folder = folder;
    this.signing = signing;
  }
}
