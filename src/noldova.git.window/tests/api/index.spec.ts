/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import * as api from "../../src/api/index.ts";
import { GitAgentState } from "../../src/app/enums/git-agent-state.ts";
import { GitPullRequestState } from "../../src/app/enums/git-pull-request-state.ts";
import { GitPullRequestsState } from "../../src/app/enums/git-pull-requests-state.ts";
import { GitFolderProvidedException } from "../../src/app/exceptions/git-folder-provided.exception.ts";
import { GitWindowException } from "../../src/app/exceptions/git-window.exception.ts";
import { GitDiffFilesComponent } from "../../src/app/components/git-diff-files/git-diff-files.component.ts";
import { GitPullRequestCommitsComponent } from "../../src/app/components/git-pull-request-commits/git-pull-request-commits.component.ts";
import { GitPullRequestConflictsComponent } from "../../src/app/components/git-pull-request-conflicts/git-pull-request-conflicts.component.ts";
import { GitPullRequestFilesComponent } from "../../src/app/components/git-pull-request-files/git-pull-request-files.component.ts";
import { GitPullRequestThreadsComponent } from "../../src/app/components/git-pull-request-threads/git-pull-request-threads.component.ts";
import { GitAgentRow } from "../../src/app/models/git-agent-row.ts";
import { GitBranchPullRequest } from "../../src/app/models/git-branch-pull-request.ts";
import { GitCommitComments } from "../../src/app/models/git-commit-comments.ts";
import { GitFileLine } from "../../src/app/models/git-file-line.ts";
import { GitPullRequestList } from "../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../src/app/models/git-pull-request-row.ts";
import { ThreadLine } from "../../src/app/models/thread-line.ts";
import { FocusKeeper } from "../../src/app/services/focus-keeper.ts";
import { GitFolder } from "../../src/app/services/git-folder.ts";
import { GitViewOptions } from "../../src/app/services/git-view-options.ts";
import { GitHostRows } from "../../src/app/services/git-host-rows.ts";
import { GitHostAccounts } from "../../src/app/services/git-host-accounts.ts";
import { GitHostCard } from "../../src/app/models/git-host-card.ts";
import { GitHostCardState } from "../../src/app/enums/git-host-card-state.ts";
import { GitHostFeature } from "../../src/app/enums/git-host-feature.ts";
import { GitAvatars } from "../../src/app/services/git-avatars.ts";
import { GitAgents } from "../../src/app/services/git-agents.ts";
import { GitCommitPrefixes } from "../../src/app/services/git-commit-prefixes.ts";
import { GitCounts } from "../../src/app/services/git-counts.ts";
import { GitLinkReferences } from "../../src/app/services/git-link-references.ts";
import { GitPullRequests } from "../../src/app/services/git-pull-requests.ts";
import { GitRepositoryLink } from "../../src/app/models/git-repository-link.ts";
import { GitRepositoryLinks } from "../../src/app/services/git-repository-links.ts";
import { GitHistorySelection } from "../../src/app/services/git-history-selection.ts";
import { GitDetailView } from "../../src/app/services/git-detail-view.ts";
import { GitRecentRepositories } from "../../src/app/services/git-recent-repositories.ts";
import { GitWindowPart, windowPart } from "../../src/app/services/git-window-part.ts";
import { GitWorkspaces } from "../../src/app/services/git-workspaces.ts";

describe("api", () => {
  it("exports the Git module's window part as windowPart", () => {
    expect(api.windowPart).toBeInstanceOf(GitWindowPart);
    expect(api.windowPart.moduleId).toBe("git");
  });

  it("exports the folder provider, the host rows and accounts, the agent runs, the commit prefixes, the counts' words, the focus keeper, the pull request lists, branch pull requests and commit comments, the repository panel's host rows, the workspaces, the repositories opened lately, the history selection, the detail view, the diff's files view, the pull request page's Commits, Files and Conflicts tabs and the file line its Files tab reveals, its comment threads and the thread line they go to, the provider's exception and the exceptions' base, and nothing else", () => {
    expect(Object.fromEntries(Object.entries(api))).toEqual({
      FocusKeeper, GitAgentRow, GitAgentState, GitAgents, GitAvatars, GitBranchPullRequest, GitCommitComments, GitCommitPrefixes, GitCounts, GitDetailView, GitDiffFilesComponent, GitFileLine, GitFolder, GitFolderProvidedException, GitHistorySelection, GitHostAccounts, GitHostCard,
      GitHostCardState, GitHostFeature, GitHostRows, GitLinkReferences, GitPullRequestCommitsComponent, GitPullRequestConflictsComponent, GitPullRequestFilesComponent,
      GitPullRequestList, GitPullRequestRow, GitPullRequestState, GitPullRequests, GitPullRequestsState, GitRecentRepositories,
      GitPullRequestThreadsComponent, GitRepositoryLink, GitRepositoryLinks, GitViewOptions, GitWindowException, GitWorkspaces, ThreadLine, windowPart
    });
    expect(new api.GitFolderProvidedException()).toBeInstanceOf(api.GitWindowException);
  });
});
