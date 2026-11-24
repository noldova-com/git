/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { StatusUpstream } from "@noldova/git.protocol";

/** The branch a pull brings commits into, and the upstream it pulls them from. */
export class PulledBranch {
  public readonly branch: string;
  public readonly upstream: StatusUpstream;

  public constructor(branch: string, upstream: StatusUpstream) {
    this.branch = branch;
    this.upstream = upstream;
  }
}
