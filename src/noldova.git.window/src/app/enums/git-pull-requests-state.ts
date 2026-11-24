/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** Where a host's read of a repository's open pull requests stands. */
export enum GitPullRequestsState {
  /** The host is reading them, and has none to show yet. */
  Reading = "Reading",
  /** The host read them. */
  Ready = "Ready",
  /** Nobody is signed in to the host, so it can't read them. */
  SignedOut = "SignedOut",
  /** The host's read failed. */
  Failed = "Failed"
}
