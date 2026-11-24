/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostReference } from "@noldova/git.hosting.protocol";

import type { IGitPullRequestHost } from "../../src/app/interfaces/i-git-pull-request-host.ts";

export class TestPullRequestHost implements IGitPullRequestHost {
  public static readonly commitsMethod: string = "git-example.readPullRequestCommits";
  public static readonly changesMethod: string = "git-example.readPullRequestChanges";
  public static readonly conflictsMethod: string = "git-example.readPullRequestConflicts";
  public static readonly threadsMethod: string = "git-example.readPullRequestThreads";
  public static readonly replyMethod: string = "git-example.replyToThread";
  public static readonly changeMethod: string = "git-example.changeThread";

  public readonly name: string = "Example";
  public readonly readCommitsMethod: string = TestPullRequestHost.commitsMethod;
  public readonly readChangesMethod: string = TestPullRequestHost.changesMethod;
  public readonly readConflictsMethod: string = TestPullRequestHost.conflictsMethod;
  public readonly readThreadsMethod: string = TestPullRequestHost.threadsMethod;
  public replyToThreadMethod: string | null = TestPullRequestHost.replyMethod;
  public changeThreadMethod: string | null = TestPullRequestHost.changeMethod;
  /** The people whose pictures were asked, each as `{owner}/{login}`. */
  public readonly askedPeople: string[] = [];
  /** The picture each person's ask answers. */
  public avatar: string | null | undefined = null;
  public readonly asked: string[] = [];
  public folder: string | null = null;
  public failure: Error | null = null;

  public async localFolderAsync(pullRequestUrl: string): Promise<string | null> {
    this.asked.push(pullRequestUrl);
    if (this.failure !== null)
      throw this.failure;
    return this.folder;
  }

  public commitPageOf(pullRequestUrl: string, commitId: string): string {
    return `${pullRequestUrl}/commits/${commitId}`;
  }

  public personAvatarOf(reference: HostReference, login: string): string | null | undefined {
    this.askedPeople.push(`${reference.owner}/${login}`);
    return this.avatar;
  }
}
