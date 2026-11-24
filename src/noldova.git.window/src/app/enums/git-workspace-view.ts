/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A view in the workspace page's side panel, which shows only the repositories it names. */
export enum GitWorkspaceView {
  /** The branch is behind its upstream. */
  Behind = "Behind",
  /** The working folder has uncommitted changes or conflicts. */
  Changed = "Changed",
  /** The branch's open pull request waits for its reviews. */
  WaitingForReview = "WaitingForReview",
  /** An agent works in the repository or waits for the person. */
  AgentsAtWork = "AgentsAtWork"
}
