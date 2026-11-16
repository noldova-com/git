/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostCheck, HostItem } from "@noldova/git.hosting.protocol";

import type { GitHubLook } from "./github-look.ts";

export class ShownPullRequest {
  public readonly pullRequest: HostItem;
  public readonly look: GitHubLook;
  public readonly checks: readonly HostCheck[];

  public constructor(pullRequest: HostItem, look: GitHubLook, checks: readonly HostCheck[]) {
    this.pullRequest = pullRequest;
    this.look = look;
    this.checks = checks;
  }
}
