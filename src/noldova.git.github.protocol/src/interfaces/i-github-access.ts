/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitHubAccessGrant } from "../models/github-access-grant.ts";
import type { GitHubAccessRefusal } from "../models/github-access-refusal.ts";

export interface IGitHubAccess {
  accessAsync(signal: AbortSignal): Promise<GitHubAccessGrant | GitHubAccessRefusal>;
  accessForAsync(repository: { readonly host: string; readonly path: string }, signal: AbortSignal): Promise<GitHubAccessGrant | GitHubAccessRefusal>;
}
