/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** Where a branch's pull request stands on its host. */
export enum GitPullRequestState {
  Open = "Open",
  Draft = "Draft",
  Merged = "Merged",
  /** Closed without merging, or abandoned. */
  Closed = "Closed"
}
