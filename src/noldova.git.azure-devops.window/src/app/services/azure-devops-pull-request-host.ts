/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import type { HostReference } from "@noldova/git.hosting.protocol";
import type { IGitPullRequestHost } from "@noldova/git.window";

import { AzureDevOpsAuthorAvatars } from "./azure-devops-author-avatars.ts";
import { AzureDevOpsLocalFolder } from "./azure-devops-local-folder.ts";
import { Resources } from "../../resources.ts";

export class AzureDevOpsPullRequestHost implements IGitPullRequestHost {
  private readonly context: IWindowPartContext;
  private readonly avatars: AzureDevOpsAuthorAvatars;

  public readonly name: string = Resources.hostName;
  public readonly readCommitsMethod: string = AzureDevOpsNames.readPullRequestCommitsMethod;
  public readonly readChangesMethod: string = AzureDevOpsNames.readPullRequestChangesMethod;
  public readonly readConflictsMethod: string = AzureDevOpsNames.readPullRequestConflictsMethod;
  public readonly readThreadsMethod: string = AzureDevOpsNames.readPullRequestThreadsMethod;
  public readonly replyToThreadMethod: string = AzureDevOpsNames.replyToThreadMethod;
  public readonly changeThreadMethod: string = AzureDevOpsNames.changeThreadMethod;

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.avatars = AzureDevOpsAuthorAvatars.register(context);
  }

  public localFolderAsync(pullRequestUrl: string): Promise<string | null> {
    return AzureDevOpsLocalFolder.readAsync(this.context, pullRequestUrl);
  }

  public commitPageOf(pullRequestUrl: string, commitId: string): string {
    return Resources.formatCommitPage(pullRequestUrl, commitId);
  }

  public personAvatarOf(reference: HostReference, login: string): string | null | undefined {
    return this.avatars.personAvatarOf(reference.owner, login);
  }
}
