/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";

import type { IGitPullRequests } from "../interfaces/i-git-pull-requests.ts";

/** A host module's pull request list, with the context it was given by. */
export class GitProvidedPullRequests {
  public readonly context: IWindowPartContext;
  public readonly pullRequests: IGitPullRequests;

  public constructor(context: IWindowPartContext, pullRequests: IGitPullRequests) {
    this.context = context;
    this.pullRequests = pullRequests;
  }
}
