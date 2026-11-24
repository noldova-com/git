/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostReviewRequest } from "@noldova/git.hosting.protocol";

/** The account's review requests a search found, and whether the search was cut. */
export type ReviewSearchAnswer = readonly [readonly HostReviewRequest[], boolean];
