/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostPolicy } from "@noldova/git.hosting.protocol";

/** A pull request's policy, whether it's a build policy, and the id of the build its evaluation ran; null when it ran none. */
export class EvaluatedPolicy {
  public readonly policy: HostPolicy;
  public readonly isBuild: boolean;
  public readonly buildId: number | null;

  public constructor(policy: HostPolicy, isBuild: boolean, buildId: number | null) {
    this.policy = policy;
    this.isBuild = isBuild;
    this.buildId = buildId;
  }
}
