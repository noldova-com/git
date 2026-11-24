/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostReviewer } from "@noldova/git.hosting.protocol";

import type { PullAfter } from "./pull-after.ts";

/**
 * What the Pull request view hands back to the page that read the pull request: a write that changed it, with the pull to run once it merges, and a
 * reviewer added.
 */
export type PullRequestActions = { readonly changed: (pull: PullAfter | null) => void; readonly added: (reviewer: HostReviewer) => void };
