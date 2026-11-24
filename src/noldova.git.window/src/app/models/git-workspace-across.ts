/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IGitWorkspaceAcrossPage } from "../interfaces/i-git-workspace-across-page.ts";
import type { GitWorkspaceReviews } from "./git-workspace-reviews.ts";
import type { GitWorkspaceRow } from "./git-workspace-row.ts";
import type { GitWorkspaceRun } from "./git-workspace-run.ts";

/** What the Across repositories view shows of a workspace page: its repositories, the agents' runs in them, the reviews asked of the person, and the page. */
export class GitWorkspaceAcross {
  /** The page's instance, which tells one workspace page from another. */
  public readonly instance: string;
  /** Every repository of the workspace, whether or not its row is on screen. */
  public readonly rows: readonly GitWorkspaceRow[];
  public readonly runs: readonly GitWorkspaceRun[];
  public readonly reviews: GitWorkspaceReviews;
  public readonly page: IGitWorkspaceAcrossPage;

  public constructor(instance: string, rows: readonly GitWorkspaceRow[], runs: readonly GitWorkspaceRun[], reviews: GitWorkspaceReviews,
    page: IGitWorkspaceAcrossPage) {
    this.instance = instance;
    this.rows = rows;
    this.runs = runs;
    this.reviews = reviews;
    this.page = page;
  }
}
