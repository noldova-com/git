/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostCheck, HostItem } from "@noldova/git.hosting.protocol";

export class ShownPullRequest {
  public readonly pullRequest: HostItem;
  public readonly checks: readonly HostCheck[];

  public constructor(pullRequest: HostItem, checks: readonly HostCheck[]) {
    this.pullRequest = pullRequest;
    this.checks = checks;
  }
}
