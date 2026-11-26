/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostReviewer } from "@noldova/git.hosting.protocol";

import type { PullAfter } from "../models/pull-after.ts";

export interface IPullRequestActions {
  readonly changed: (pull: PullAfter | null) => void;
  readonly added: (reviewer: HostReviewer) => void;
}
