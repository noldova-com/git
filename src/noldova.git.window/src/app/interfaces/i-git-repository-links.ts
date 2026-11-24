/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRemote } from "@noldova/git.protocol";

import type { GitRepositoryLink } from "../models/git-repository-link.ts";

/** What a host module gives the repository panel so that it shows rows for the host's pages under Changes and History. */
export interface IGitRepositoryLinks {
  /** The rows for a repository whose remote this is, in order; none for a remote the host doesn't claim. */
  linksFor(remote: GitRemote): readonly GitRepositoryLink[];
}
