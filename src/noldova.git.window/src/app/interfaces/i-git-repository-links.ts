/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRemote } from "@noldova/git.protocol";

import type { GitRepositoryLink } from "../models/git-repository-link.ts";

export interface IGitRepositoryLinks {
  linksFor(remote: GitRemote): readonly GitRepositoryLink[];
}
