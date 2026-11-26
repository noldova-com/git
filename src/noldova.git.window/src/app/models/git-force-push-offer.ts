/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { GitStatus } from "@noldova/git.protocol";

export class GitForcePushOffer {
  public readonly branch: string;
  public readonly upstream: string;
  public readonly expected: string;

  public constructor(branch: string, upstream: string, expected: string) {
    this.branch = branch;
    this.upstream = upstream;
    this.expected = expected;
  }

  public static of(status: GitStatus | null): GitForcePushOffer | null {
    const upstream = status?.upstream ?? null;
    if (Object.isNull(status) || Object.isNull(status.branch) || Object.isNull(upstream) || upstream.behind === 0 || Object.isNull(upstream.id))
      return null;
    return new GitForcePushOffer(status.branch, upstream.name, upstream.id);
  }
}
