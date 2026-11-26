/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostReference } from "@noldova/git.hosting.protocol";

export interface IGitPullRequestHost {
  readonly name: string;
  readonly readCommitsMethod: string;
  readonly readChangesMethod: string;
  readonly readConflictsMethod: string;
  readonly readThreadsMethod: string;
  readonly replyToThreadMethod: string | null;
  readonly changeThreadMethod: string | null;

  localFolderAsync(pullRequestUrl: string): Promise<string | null>;

  commitPageOf(pullRequestUrl: string, commitId: string): string;

  personAvatarOf(reference: HostReference, login: string): string | null | undefined;
}
