/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type ConflictKind, type DiffScopeKind, type FileChange, type FileState, type GitPrediction, type OperationKind, PredictionOutcome, type RebaseAction, type RebaseCheckOutcome,
  RemoteTransport, SignatureState, type SigningFormat } from "@noldova/git.protocol";
import { FileChangeKind, ThreadStatus } from "@noldova/git.hosting.protocol";
import type { IconName } from "@noldova/ui.components.angular";

import { GitPullRequestState } from "./app/enums/git-pull-request-state.ts";
import { GitAgentState } from "./app/enums/git-agent-state.ts";
import { GitFileGroupKind } from "./app/enums/git-file-group-kind.ts";
import { GitHostFeature } from "./app/enums/git-host-feature.ts";
import { GitHistoryAction } from "./app/enums/git-history-action.ts";
import { GitFileLayout } from "./app/enums/git-file-layout.ts";
import type { GitResolvedBy } from "./app/enums/git-resolved-by.ts";
import { GitWorkspaceView } from "./app/enums/git-workspace-view.ts";
import { GitHistoryToolbar } from "./app/models/git-history-toolbar.ts";
import { GitWorkspaceViewLabel } from "./app/models/git-workspace-view-label.ts";

export class Resources {
  public static readonly maximumPathLength: number = 4_096;
  public static readonly absolutePathPattern: RegExp = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/u;
  public static readonly folderProvided: string = "This window already has a Git folder provider; unregister it before providing another.";
  public static readonly blankFolder: string = "the folder is blank";
  public static readonly relativeFolder: string = "the folder isn't an absolute path";

  public static readonly viewName: string = "git.view";
  public static readonly viewTitle: string = "Git";
  public static readonly viewIcon: IconName = "account_tree";
  public static readonly viewDefaultGroup: number = 0;
  public static readonly viewDefaultOrder: number = 20;
  public static readonly accountsPage: string = "git.accounts";
  public static readonly accountsTitle: string = "Accounts and hosts";
  public static readonly accountsIntro: string = "Tokens stay in the system's secure store. Each host's features appear only where that host has them.";
  public static readonly addAccount: string = "Add an account";
  public static readonly addAccountIcon: IconName = "add";
  public static readonly manageAccountIcon: IconName = "more_horiz";
  public static readonly noHosts: string = "No host module is on, so there is no account to add.";
  public static readonly featuresTitle: string = "What each host can do";
  public static readonly featureYesIcon: IconName = "check";
  public static readonly featureNoIcon: IconName = "remove";
  public static readonly featureYes: string = "Yes";
  public static readonly featureNo: string = "No";
  public static readonly accountInput: string = "account";
  public static readonly dialogTitleInput: string = "title";
  public static readonly accountRowPrefix: string = "git.account.";
  public static readonly hostFeatures: readonly GitHostFeature[] = Object.values(GitHostFeature);
  public static readonly hostFeatureTitles: Readonly<Record<GitHostFeature, string>> = {
    [GitHostFeature.PullRequests]: "Pull requests",
    [GitHostFeature.VotesAndPolicies]: "Votes and policies",
    [GitHostFeature.BuildsOnCommits]: "Builds on commits",
    [GitHostFeature.WorkItems]: "Work items",
    [GitHostFeature.BranchFromItem]: "Branch from item",
    [GitHostFeature.AutoComplete]: "Auto-complete"
  };
  public static readonly getGitAddress: string = "https://git-scm.com/downloads";
  /** The controls the focus can move to when the one holding it goes, and the one holding it. */
  public static readonly focusableSelector: string = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";
  public static readonly focusedSelector: string = ":focus";
  public static readonly disabledAttribute: string = "disabled";
  public static readonly linkNotOpened: string = "The page couldn't be opened; the app's log has the details.";
  public static readonly slash: string = "/";
  public static readonly dot: string = ".";
  public static readonly ellipsis: string = "…";
  public static readonly folderTailLength: number = 12;
  public static readonly shownFilesMaximum: number = 3;
  public static readonly shortHeadLength: number = 7;

  public static readonly branchIconPath: string = "M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z";
  public static readonly menuClosedIcon: IconName = "keyboard_arrow_down";
  public static readonly menuOpenIcon: IconName = "keyboard_arrow_up";
  public static readonly pushIcon: IconName = "arrow_upward";
  public static readonly pullIcon: IconName = "arrow_downward";
  public static readonly publishIcon: IconName = "cloud_upload";
  public static readonly stageIcon: IconName = "add";
  public static readonly unstageIcon: IconName = "remove";
  public static readonly discardIcon: IconName = "undo";
  public static readonly discardLabel: string = "Discard";
  public static readonly discardTitle: string = "Discard changes?";
  public static readonly undoLabel: string = "Undo";
  public static readonly discardedIcon: IconName = "restore_page";
  public static readonly commitIcon: IconName = "check";
  public static readonly expandIcon: IconName = "keyboard_arrow_down";
  public static readonly collapseIcon: IconName = "keyboard_arrow_up";
  public static readonly wrapIcon: IconName = "wrap_text";
  public static readonly mergeIcon: IconName = "merge";
  public static readonly failureIcon: IconName = "error";
  public static readonly plainRemoteIcon: IconName = "dns";
  public static readonly noFolderIcon: IconName = "folder_off";
  public static readonly folderUnreadableIcon: IconName = "lock";
  public static readonly gitMissingIcon: IconName = "error";
  public static readonly gitTooOldIcon: IconName = "warning";
  public static readonly watchFailedIcon: IconName = "sync_problem";
  public static readonly openLinkIcon: IconName = "open_in_new";
  public static readonly createBranchIcon: IconName = "add";
  public static readonly currentBranchIcon: IconName = "check";

  public static readonly switchBranchLabel: string = "Switch or create a branch";
  public static readonly publishLabel: string = "Publish branch";
  public static readonly pushLabel: string = "Push";
  public static readonly pullLabel: string = "Pull";
  public static readonly pullDescription: string = "Fetches and fast-forwards only";
  public static readonly pullHooksUnread: string = "Fetches and fast-forwards only, running the repository's hooks";
  public static readonly noUpstream: string = "No upstream yet";
  public static readonly stageAllLabel: string = "Stage all";
  public static readonly unstageAllLabel: string = "Unstage all";
  public static readonly stageLabel: string = "Stage";
  public static readonly unstageLabel: string = "Unstage";
  public static readonly showDiffLabel: string = "Show the diff";
  public static readonly hideDiffLabel: string = "Hide the diff";
  public static readonly stageHunkLabel: string = "Stage hunk";
  public static readonly unstageHunkLabel: string = "Unstage hunk";
  public static readonly wrapLinesLabel: string = "Wrap lines";
  public static readonly unwrapLinesLabel: string = "Don't wrap lines";
  public static readonly messageLabel: string = "Commit message";
  public static readonly messagePlaceholder: string = "Message";
  public static readonly commitLabel: string = "Commit";
  public static readonly branchPickerLabel: string = "Find or name a branch";
  public static readonly localBranchesLabel: string = "Local branches";
  public static readonly remoteBranchesLabel: string = "Remote branches";
  public static readonly createBranchPrompt: string = "Create branch from here…";
  public static readonly noDiff: string = "Git shows no lines for this file.";
  public static readonly binaryDiff: string = "Binary file: no lines to show.";
  public static readonly diffCut: string = "The diff is cut short here.";
  public static readonly loadingDiff: string = "Reading the diff…";
  public static readonly noStatus: string = "The Git view has no status to read a diff against.";
  public static readonly noNewlineAtEnd: string = "\\ No newline at end of file";
  public static readonly addedPrefix: string = "+";
  public static readonly removedPrefix: string = "-";
  public static readonly contextPrefix: string = " ";
  public static readonly listCut: string = "Git listed only part of this folder's changes.";
  public static formatUncheckedLfs(count: number): string {
    return count === 1
      ? "One Git LFS file wasn't checked against its pointer, so it may show as changed when it isn't."
      : `${Resources.formatCountStart(count)} Git LFS files weren't checked against their pointers, so they may show as changed when they aren't.`;
  }
  public static readonly noChanges: string = "No changes";
  public static readonly dismissLabel: string = "Dismiss";

  public static readonly noFolderHeading: string = "No folder";
  public static readonly noFolderText: string = "Open a folder to see its Git state.";
  public static readonly notRepositoryHeading: string = "Not a Git repository";
  public static readonly folderUnreadableHeading: string = "Can't read this folder";
  public static readonly gitMissingHeading: string = "Git isn't installed";
  public static readonly gitMissingText: string = "The Git view uses the Git on your computer. Install Git 2.39 or newer, then select Check again.";
  public static readonly gitTooOldText: string = "The Git view needs Git 2.39 or newer. Update the Git on your computer, then select Check again.";
  public static readonly failedHeading: string = "Git couldn't read this folder";
  public static readonly folderFailedHeading: string = "The app's folder couldn't be read";
  public static readonly getGitLabel: string = "Get Git";
  public static readonly checkAgainLabel: string = "Check again";

  public static readonly ssh: string = "SSH";
  public static readonly https: string = "HTTPS";
  public static readonly filePath: string = "a file path";
  public static readonly otherTransport: string = "its own transport";

  public static readonly stateLetters: Readonly<Record<FileState, string>> = {
    Unmodified: "", Ignored: "I", Modified: "M", TypeChanged: "T", Added: "A", Deleted: "D", Renamed: "R", Copied: "C", Untracked: "U"
  };

  public static readonly conflictLetter: string = "!";

  public static readonly conflictKinds: Readonly<Record<ConflictKind, string>> = {
    BothModified: "Both changed", BothAdded: "Both added", BothDeleted: "Both deleted", AddedByUs: "Added by us", AddedByThem: "Added by them",
    DeletedByUs: "Deleted by us", DeletedByThem: "Deleted by them"
  };

  public static readonly operations: Readonly<Record<OperationKind, string>> = {
    Merge: "Merging", Rebase: "Rebasing", CherryPick: "Cherry-picking", Revert: "Reverting"
  };

  public static readonly groupTitles: Readonly<Record<GitFileGroupKind, string>> = {
    [GitFileGroupKind.Conflicts]: "Conflicts", [GitFileGroupKind.Staged]: "Staged", [GitFileGroupKind.Changes]: "Changes"
  };

  public static formatMoreChips(count: number): string {
    return `+${count}`;
  }

  public static formatMoreChipsTitle(titles: readonly string[]): string {
    return titles.join(Resources.listSeparator);
  }

  public static formatRenameLabel(branch: string): string {
    return `New name for ${branch}`;
  }

  public static formatFolderTooLong(maximum: number): string {
    return `the folder has more than ${maximum} characters`;
  }

  public static formatChangedRefused(reason: string): string {
    return `The Git view ignored a change event it could not read: ${reason}`;
  }

  public static formatSigningFailed(reason: string): string {
    return `The Git view couldn't read how commits are signed: ${reason}`;
  }

  /** The commit card's note that a new commit will be signed, by the format it is signed in. */
  public static readonly signingNotes: Readonly<Record<SigningFormat, string>> = {
    OpenPgp: "Signed with a GPG key", Ssh: "Signed with SSH key", X509: "Signed with an X.509 certificate"
  };

  public static formatPullHooksFailed(reason: string): string {
    return `The Git view couldn't read the hooks a pull runs: ${reason}`;
  }

  public static formatPullHooks(hooks: readonly string[] | null): string {
    if (Object.isNull(hooks))
      return Resources.pullHooksUnread;
    return `${Resources.pullDescription}. Hooks that will run: ${hooks.length === 0 ? "None" : hooks.join(", ")}`;
  }

  public static formatWatchFailed(reason: string): string {
    return `Changes made outside the Git view aren't followed, since the folder couldn't be watched: ${reason}`;
  }

  public static formatStatusBarWatchFailed(folder: string, reason: string): string {
    return `The status bar doesn't follow changes made outside the window in ${folder}, since it couldn't be watched: ${reason}`;
  }

  public static formatStatusBarUnwatchFailed(folder: string, reason: string): string {
    return `The status bar couldn't stop watching ${folder}: ${reason}`;
  }

  public static formatStatusBarReadFailed(folder: string, reason: string): string {
    return `The status bar couldn't read ${folder}: ${reason}`;
  }

  public static formatUnwatchFailed(folder: string, reason: string): string {
    return `The Git view couldn't stop watching ${folder}: ${reason}`;
  }

  public static formatFolderFailed(reason: string): string {
    return `The Git view shows no folder, since the app's folder could not be read: ${reason}`;
  }

  public static formatPullRequestsClaimFailed(reason: string): string {
    return `The repository panel passed over a host's pull requests, since its claim failed: ${reason}`;
  }

  /** The Agents section header's note: how many worktrees its runs work in. */
  public static formatAgentWorktrees(count: number): string {
    return count === 1 ? "1 worktree" : `${count} worktrees`;
  }

  /** The section header's note: the host's name, and when it has more pull requests than the section lists, that there are more. */
  /** The Dashboard's Open cell: how many pull requests the repository has open, a + when the host has more than it listed, and how many of them fail their checks. */
  public static formatOpenPullRequests(open: number, hasMore: boolean, failing: number): string {
    if (open === 0)
      return Resources.noPullRequest;
    const count: string = hasMore ? `${open}+` : `${open}`;
    return failing > 0 ? `${count} · ${failing} failing` : count;
  }

  public static formatOpenPullRequestsTitle(open: number, hasMore: boolean, failing: number): string {
    const count: string = `${open}${hasMore ? "+" : ""} open ${open === 1 && !hasMore ? "pull request" : "pull requests"}`;
    return failing > 0 ? `${count}, ${failing} with failing checks` : count;
  }

  public static formatPullRequestsHost(hostName: string, count: number): string {
    return count > Resources.shownPullRequests ? `${hostName} · ${Resources.shownPullRequests}+` : hostName;
  }

  /** A pull request's row in the repository panel: its label, then its title. */
  public static formatPullRequestRowText(label: string, title: string): string {
    return `${label}${Resources.peopleSeparator}${title}`;
  }

  /** A pull request's note: its failing checks, else that checks run, else its reviews, else that it is a draft, else nothing. */
  public static formatPullRequestNote(failing: number, pending: number, approvals: number, isDraft: boolean): string {
    if (failing > 0)
      return `${failing} failing`;
    if (pending > 0)
      return Resources.pullRequestsRunning;
    if (approvals > 0)
      return approvals === 1 ? "1 review" : `${approvals} reviews`;
    return isDraft ? Resources.pullRequestsDraft : "";
  }

  public static formatAccountRowTitle(host: string): string {
    return `${host} account`;
  }

  public static formatAccountRowNote(host: string): string {
    return `Sign in to ${host}, see who is signed in, and sign out.`;
  }

  public static formatSignInTitle(host: string): string {
    return `Sign in to ${host}`;
  }

  public static formatManageAccount(host: string): string {
    return `Manage the ${host} account`;
  }

  public static formatHostRowFailed(reason: string): string {
    return `The Git view shows the plain remote line, since a host row's claim failed: ${reason}`;
  }

  public static formatCommitPrefixFailed(reason: string): string {
    return `The commit message starts without a host's prefix, since its answer failed: ${reason}`;
  }

  public static formatFolderUnreadableText(folder: string): string {
    return `Your account doesn't have permission to open this folder, ${folder}.`;
  }

  public static formatNotRepositoryText(folder: string): string {
    return `This folder, ${folder}, isn't inside a Git repository.`;
  }

  public static formatPush(ahead: number): string {
    return ahead === 0 ? Resources.pushLabel : `${Resources.pushLabel} ${ahead}`;
  }

  public static formatPull(behind: number): string {
    return behind === 0 ? Resources.pullLabel : `${Resources.pullLabel} ${behind}`;
  }

  public static formatAheadBehind(ahead: number, behind: number): string {
    return `↑${ahead} ahead · ↓${behind} behind`;
  }

  public static formatUpstreamGone(name: string): string {
    return `${name} is gone from its remote`;
  }

  public static formatCommit(files: number): string {
    return `${Resources.commitLabel} ${files} ${files === 1 ? "file" : "files"}`;
  }

  public static formatConflictHint(files: number, operation: OperationKind): string {
    return `Resolve the ${Resources.formatCount(files)} conflicted ${files === 1 ? "file" : "files"} to commit the ${Resources.operationNouns[operation]}.`;
  }

  /** An operation in progress as the banner heads it: the branch it applies into, or "this branch" when HEAD is detached. */
  public static formatOperation(operation: string, from: string | null, into: string | null): string {
    const target: string = into ?? "this branch";
    return Object.isNull(from) ? `${operation} into ${target}` : `${operation} ${from} into ${target}`;
  }

  public static readonly resolveConflictsLabel: string = "Resolve conflicts";

  public static formatConflictText(files: number): string {
    return files === 0
      ? "Every conflict is resolved. Commit to finish."
      : `${Resources.formatCountStart(files)} ${files === 1 ? "file has conflicts. Resolve it" : "files have conflicts. Resolve them"}, or abort.`;
  }

  public static formatSwitchBranch(name: string): string {
    return `${Resources.switchBranchLabel}, ${name}`;
  }

  /** The id of a History list's row, by the list's number among the open lists and the row's place, for the list's active descendant. */
  public static formatHistoryOptionId(list: number, index: number): string {
    return `git-history-${list}-option-${index}`;
  }

  public static formatBranchOptionId(index: number): string {
    return `git-branch-option-${index}`;
  }

  public static formatBranchItemKey(kind: string, title: string): string {
    return `${kind}:${title}`;
  }

  public static formatCreateBranch(name: string): string {
    return `Create branch ${name}`;
  }

  public static formatPlainRemote(name: string, host: string, transport: string): string {
    return `${name} is a plain Git server (${host} over ${transport}): no pull requests or checks to show.`;
  }

  public static formatGitTooOldHeading(version: string | null): string {
    return Object.isNull(version) ? "Your Git is too old" : `Git ${version} is too old`;
  }

  public static formatMoreFiles(count: number): string {
    return `and ${Resources.formatCount(count)} more`;
  }

  public static formatStage(path: string): string {
    return `${Resources.stageLabel} ${path}`;
  }

  public static formatDiscard(path: string): string {
    return `Discard changes to ${path}`;
  }

  public static formatDiscardTracked(path: string, undoable: boolean): string {
    return `The changes to ${path} in the working folder will be lost, and it goes back to what is staged. ${Resources.undoNoteOf(undoable)}`;
  }

  public static formatDiscardUntracked(path: string, undoable: boolean): string {
    return `${path} isn't tracked, so discarding deletes it. ${Resources.undoNoteOf(undoable)}`;
  }

  public static formatDiscarded(paths: readonly string[]): string {
    return paths.length === 1 ? `Discarded the changes to ${paths.join("")}.` : `Discarded the changes to ${Resources.formatCount(paths.length)} files.`;
  }

  private static undoNoteOf(undoable: boolean): string {
    return undoable ? "A checkpoint is kept, so you can undo it." : "This can't be undone.";
  }

  public static formatStageLines(count: number): string {
    return count === 1 ? "Stage 1 line" : `Stage ${count} lines`;
  }

  public static formatUnstageLines(count: number): string {
    return count === 1 ? "Unstage 1 line" : `Unstage ${count} lines`;
  }

  public static formatUnstage(path: string): string {
    return `${Resources.unstageLabel} ${path}`;
  }

  public static formatRowKey(group: GitFileGroupKind, path: string): string {
    return `${group}:${path}`;
  }

  public static formatFolderKey(folder: string): string {
    return `folder:${folder}`;
  }

  public static formatDiffKey(fingerprint: string, scope: DiffScopeKind): string {
    return `${fingerprint}:${scope}`;
  }

  public static formatHunk(oldStart: number, oldCount: number, newStart: number, newCount: number, header: string): string {
    const range = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
    return header.length === 0 ? range : `${range} ${header}`;
  }

  public static readonly historyDocumentName: string = "git.history";
  public static readonly graphPageSize: number = 2000;
  /** How far past the view the history draws rows, so a fast scroll finds them drawn: about 40 rows, and up to 80 before it draws more. */
  public static readonly graphBufferPixels: number = 1200;
  public static readonly graphLoadAhead: number = 200;
  public static readonly openHistoryCommand: string = "git.openHistory";
  public static readonly openHistoryTitle: string = "Open history";
  public static readonly historyIcon: IconName = "history";
  public static readonly graphColorCount: number = 8;
  public static readonly graphRowPixels: number = 28;
  public static readonly centringRenders: number = 5;
  public static readonly graphLanePixels: number = 16;
  public static readonly graphLaneOffsetPixels: number = 14;
  public static readonly graphDotPixels: number = 5;
  public static readonly graphHeadRingPixels: number = 6;
  public static readonly graphHeadDotPixels: number = 3;
  public static readonly graphMinimumPixels: number = 80;
  public static readonly graphMaximumLanes: number = 16;
  public static readonly changesId: string = "0".repeat(40);
  public static readonly historyLoading: string = "Reading the history\u2026";
  public static readonly historyEmpty: string = "No commits yet.";
  public static readonly historyFailed: string = "The history couldn't be read.";
  public static readonly shortIdLength: number = 7;
  /** A full commit id, SHA-1 or SHA-256. */
  public static readonly objectIdPattern: RegExp = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
  /** The one branch or tag git's prepared merge message names, as `git fmt-merge-msg` writes it; a commit it names is an id. */
  public static readonly mergedNamePattern: RegExp = /^Merge (?:remote-tracking branch|branch|tag) '([^']+)'/u;

  public static formatCommitNotLoaded(id: string): string {
    return `Commit ${id.slice(0, Resources.shortIdLength)} isn't among the history's loaded commits.`;
  }
  public static readonly historyTitleFallback: string = "History";
  public static readonly historyListLabel: string = "Commits";
  public static readonly arrowDownKey: string = "ArrowDown";
  public static readonly arrowUpKey: string = "ArrowUp";
  public static readonly localBranchIcon: IconName = "computer";
  public static readonly remoteBranchIcon: IconName = "cloud";
  public static readonly tagIcon: IconName = "sell";
  public static readonly detachedHeadIcon: IconName = "adjust";
  public static readonly headRevision: string = "HEAD";
  public static readonly listSeparator: string = ", ";
  public static readonly rowChipLimit: number = 2;
  /** The history's width in rem under which a row shows one label, as the stylesheet's narrowest column template does. */
  public static readonly historyOneChipRem: number = 44;
  public static readonly dateLocale: string = "en-US";
  public static readonly ageNow: string = "now";
  public static readonly ageYesterday: string = "Yesterday";
  public static readonly avatarColors: readonly string[] = ["default", "teal", "amber", "violet", "green", "pink", "cyan", "orange"];
  public static readonly columnRefs: string = "Branch or tag";
  public static readonly columnGraph: string = "Graph";
  public static readonly columnMessage: string = "Message";
  public static readonly columnAuthor: string = "Author";
  public static readonly columnDate: string = "Date";
  /**
   * The history's toolbars in order, each a group of actions, as Noldova Desktop's view-hosted toolbar bands will take them: until then they share one
   * row in the document, and those that don't fit move, from the end, into the row's More menu.
   */
  public static readonly historyToolbars: readonly GitHistoryToolbar[] = [
    new GitHistoryToolbar("Undo", [GitHistoryAction.UndoCommit]),
    new GitHistoryToolbar("Sync", [GitHistoryAction.Fetch, GitHistoryAction.Pull, GitHistoryAction.Push]),
    new GitHistoryToolbar("Branch", [GitHistoryAction.Branch, GitHistoryAction.Stash]),
    new GitHistoryToolbar("Terminal", [GitHistoryAction.Terminal])
  ];
  public static readonly historyActionLabels: Readonly<Record<GitHistoryAction, string>> = {
    [GitHistoryAction.UndoCommit]: "Undo commit",
    [GitHistoryAction.Redo]: "Redo",
    [GitHistoryAction.Fetch]: "Fetch",
    [GitHistoryAction.Pull]: "Pull",
    [GitHistoryAction.Push]: "Push",
    [GitHistoryAction.Branch]: "Branch",
    [GitHistoryAction.Stash]: "Stash",
    [GitHistoryAction.Terminal]: "Terminal"
  };
  public static readonly historyActionIcons: Readonly<Record<GitHistoryAction, IconName>> = {
    [GitHistoryAction.UndoCommit]: "undo",
    [GitHistoryAction.Redo]: "redo",
    [GitHistoryAction.Fetch]: "download",
    [GitHistoryAction.Pull]: "arrow_downward",
    [GitHistoryAction.Push]: "arrow_upward",
    [GitHistoryAction.Branch]: "call_split",
    [GitHistoryAction.Stash]: "inventory_2",
    [GitHistoryAction.Terminal]: "terminal"
  };
  /** The actions whose buttons show their label beside the glyph while the toolbar is wide enough; the rest show only the glyph. */
  public static readonly labeledHistoryActions: readonly GitHistoryAction[] = Object.values(GitHistoryAction).filter(t => t !== GitHistoryAction.Redo);
  /** The toolbar's width in rem from which its buttons show their labels. */
  public static readonly historyLabelsRem: number = 60;
  /** The room in rem the toolbar keeps between its last toolbar and the filter, and for the More button with its chevron and gap. */
  public static readonly historyToolbarGapRem: number = 0.25;
  public static readonly historyMoreRem: number = 2.75;
  public static readonly filterPlaceholder: string = "Filter: author, path, message";
  public static readonly notBuiltYet: string = "Not built yet";
  public static readonly toolbarLabel: string = "History actions";

  public static readonly repositoryViewName: string = "git.repository";
  public static readonly repositoryViewTitle: string = "Repository";
  public static readonly repositoryViewIcon: IconName = "folder";
  public static readonly repositoryViewDefaultGroup: number = 0;
  public static readonly repositoryViewDefaultOrder: number = 10;
  public static readonly workspacesViewName: string = "git.workspaces";
  /** In the left dock's first group, after the Repository view. */
  public static readonly workspacesViewDefaultGroup: number = 0;
  public static readonly workspacesViewDefaultOrder: number = 20;
  public static readonly repositoryLabel: string = "Repository";
  public static readonly fetchAllLabel: string = "Fetch all";
  public static readonly fetchAllRemotesTitle: string = "Fetch all: every remote of this repository";
  public static readonly changesLabel: string = "Changes";
  public static readonly historyLabel: string = "History";
  public static readonly readingBranches: string = "Reading the branches";
  public static readonly readingRepository: string = "Reading the repository";
  public static readonly branchesLabel: string = "Branches";
  public static readonly newBranchLabel: string = "New branch";
  public static readonly remotesLabel: string = "Remotes";
  public static readonly agentsLabel: string = "Agents";
  public static readonly agentIcon: IconName = "smart_toy";
  public static readonly agentsEmpty: string = "No agents work in this repository";
  /** Each run state's icon and its spoken name, as the artboard draws them. */
  public static readonly agentStateIcons: Readonly<Record<GitAgentState, IconName>> = {
    [GitAgentState.Working]: "progress_activity",
    [GitAgentState.WaitingForYou]: "pan_tool",
    [GitAgentState.Done]: "check_circle",
    [GitAgentState.Failed]: "error"
  };
  public static readonly agentStateLabels: Readonly<Record<GitAgentState, string>> = {
    [GitAgentState.Working]: "Working",
    [GitAgentState.WaitingForYou]: "Waiting for you",
    [GitAgentState.Done]: "Done",
    [GitAgentState.Failed]: "Failed"
  };
  public static readonly pullRequestsLabel: string = "Pull requests";
  /** The most pull requests the section lists; past it, the header says there are more. */
  public static readonly shownPullRequests: number = 20;
  public static readonly pullRequestsReading: string = "Reading pull requests…";
  public static readonly goToLine: string = "Go to line";
  public static readonly commentsTitle: string = "Comments";
  public static readonly noComments: string = "No comments yet.";
  public static readonly unfoldIcon: IconName = "unfold_more";
  public static readonly threadData: string = "thread";
  public static readonly replyLabel: string = "Reply to this thread";
  public static readonly replyPlaceholder: string = "Write a reply in Markdown";
  public static readonly replyAction: string = "Reply";
  public static readonly threadIcon: IconName = "forum";
  public static readonly resolveThread: string = "Resolve";
  public static readonly reactivateThread: string = "Reactivate";
  public static readonly autoCompleteResolveConfirm: string = "This is the last open thread of a pull request that completes by itself, so resolving it may merge it at once.";
  public static readonly resolveAnyway: string = "Resolve anyway";
  public static readonly cancelAction: string = "Cancel";
  public static readonly commentDateFormat: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  public static readonly openThreadStates: readonly ThreadStatus[] = [ThreadStatus.Active, ThreadStatus.Pending];
  public static readonly doneThreadStates: readonly ThreadStatus[] = [ThreadStatus.Resolved, ThreadStatus.WontFix, ThreadStatus.ByDesign, ThreadStatus.Closed];
  public static readonly threadLabels: Readonly<Record<ThreadStatus, string>> = {
    [ThreadStatus.Active]: "Active",
    [ThreadStatus.Pending]: "Pending",
    [ThreadStatus.Resolved]: "Resolved",
    [ThreadStatus.WontFix]: "Won't fix",
    [ThreadStatus.ByDesign]: "By design",
    [ThreadStatus.Closed]: "Closed",
    [ThreadStatus.None]: ""
  };
  public static readonly pullRequestsEmpty: string = "No open pull requests";
  public static readonly pullRequestsSignIn: string = "Sign in to see pull requests";
  public static readonly tryAgainLabel: string = "Try again";
  public static readonly pullRequestsDraft: string = "Draft";
  public static readonly pullRequestsRunning: string = "checks running";
  /** The window's command that opens Settings, and its argument naming the page. */
  public static readonly openSettingsCommand: string = "desktop.openSettings";
  public static readonly settingsPageArgument: string = "page";
  /** The terminal module's command that opens a terminal in a new tab, and its argument naming the folder it starts in. */
  public static readonly newTerminalCommand: string = "terminal.new";
  public static readonly terminalFolderArgument: string = "folder";
  public static readonly tagsLabel: string = "Tags";
  public static readonly stashesLabel: string = "Stashes";
  public static readonly worktreesLabel: string = "Worktrees";
  public static readonly submodulesLabel: string = "Submodules";
  public static readonly folderIcon: IconName = "folder";
  public static readonly syncIcon: IconName = "sync";
  public static readonly changesIcon: IconName = "edit_note";
  public static readonly sectionOpenIcon: IconName = "keyboard_arrow_down";
  public static readonly sectionClosedIcon: IconName = "chevron_right";
  public static readonly remoteIcon: IconName = "cloud";
  /** A side panel row's start inset, in rem. */
  public static readonly rowInsetRem: number = 0.5;
  /** The local branch tree's folders open and close by keys under this, apart from the sections' and remotes' keys. */
  public static readonly localTreeKey: string = "refs/heads/";
  /** How far each level of the branch trees steps in, in rem: an icon and the gap after it. */
  public static readonly treeStepRem: number = 1.375;
  public static readonly worktreeIcon: IconName = "account_tree";
  public static readonly stashIcon: IconName = "inventory_2";
  public static readonly submoduleIcon: IconName = "folder_special";
  public static readonly repositoryLoading: string = "Reading the repository…";
  public static readonly switchingLabel: string = "Switching";
  public static readonly switchingIcon: IconName = "progress_activity";

  public static readonly suggestLabel: string = "Suggest";
  public static readonly suggestIcon: IconName = "stars_2";
  public static readonly amendLabel: string = "Amend the last commit";
  public static readonly amendCommitLabel: string = "Amend commit";
  public static readonly amendTitle: string = "Replace the last commit with its changes and the staged ones, under this message";
  public static readonly amendPushedTitle: string = "The last commit is already pushed, or there is none, so it can't be amended";
  public static readonly commitAndPushLabel: string = "Commit and push";

  public static formatOnBranch(branch: string): string {
    return `on ${branch}`;
  }

  public static readonly statusBarItemName: string = "git.branch";
  public static readonly statusBarBranchIcon: IconName = "call_split";
  public static readonly fetchedItemName: string = "git.fetched";
  public static readonly commandItemName: string = "git.lastCommand";
  public static readonly commandLogViewName: string = "git.commands";
  public static readonly commandLogDefaultGroup: number = 0;
  public static readonly commandLogDefaultOrder: number = 20;
  public static readonly openCommandLogCommand: string = "git.openCommandLog";
  public static readonly openCommandLogTitle: string = "Open the command log";
  public static readonly commandLogIcon: IconName = "receipt_long";
  /** Opens a repository's Conflicts screen, for another module's page, such as a pull request's conflicts. */
  public static readonly openConflictsCommand: string = "git.openConflicts";
  public static readonly openConflictsTitle: string = "Open conflicts";
  public static readonly commandLogLabel: string = "Command log";
  public static readonly commandLogHint: string = "The git commands your writes in this repository ran since the app started, newest first.";
  public static readonly commandLogEmpty: string = "No git commands yet: each write you make here shows its command as it runs.";
  public static readonly commandDoneIcon: IconName = "check_circle";
  public static readonly commandFailedIcon: IconName = "error";
  public static readonly commandStoppedIcon: IconName = "do_not_disturb_on";
  /** How much of the last command the status bar shows before an ellipsis. */
  public static readonly commandItemLength: number = 60;

  public static formatCommandLogWatchFailed(folder: string, reason: string): string {
    return `The command log of ${folder} doesn't follow new commands, since the folder couldn't be watched: ${reason}`;
  }

  public static formatCommandLogUnwatchFailed(folder: string, reason: string): string {
    return `The command log couldn't stop watching ${folder}: ${reason}`;
  }

  public static formatCommandLogTitle(folder: string): string {
    return `${Resources.commandLogLabel}: ${Resources.formatHistoryTitle(folder)}`;
  }

  /** How a command ended: done, its exit code, or that it didn't run to its end. */
  public static formatCommandExit(exitCode: number | null): string {
    return Object.isNull(exitCode) ? "Didn't finish" : exitCode === 0 ? "Done" : `Exit code ${exitCode}`;
  }

  public static formatCommandDuration(milliseconds: number): string {
    return milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(1)} s`;
  }

  /** The last command's item text: its line, cut with an ellipsis past the item's length. */
  public static formatCommandItem(line: string): string {
    return line.length > Resources.commandItemLength ? `${line.slice(0, Resources.commandItemLength - 1)}…` : line;
  }

  public static formatCommandItemTooltip(line: string, exitCode: number | null, milliseconds: number): string {
    return `${line}\n${Resources.formatCommandExit(exitCode)} in ${Resources.formatCommandDuration(milliseconds)}. Open the command log`;
  }

  /** The fetch item's text, as the minutes since the last fetch read: just now, then minutes, hours and days. */
  public static formatFetched(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1)
      return "Fetched just now";
    if (hours < 1)
      return minutes === 1 ? "Fetched 1 minute ago" : `Fetched ${minutes} minutes ago`;
    if (days < 1)
      return hours === 1 ? "Fetched 1 hour ago" : `Fetched ${hours} hours ago`;
    return days === 1 ? "Fetched 1 day ago" : `Fetched ${days} days ago`;
  }

  public static formatFetchedTooltip(time: string): string {
    return `Last fetched ${time}`;
  }

  public static formatDetachedAt(shortId: string): string {
    return `Detached at ${shortId}`;
  }

  /** The status-bar item's tooltip: the branch, and how far it is from its upstream when it has one. Opens the history on a click. */
  public static formatStatusBarTooltip(name: string, upstream: string | null, ahead: number, behind: number): string {
    const tracking = Object.isNull(upstream) ? "no upstream" : `${ahead} ahead of and ${behind} behind ${upstream}`;
    return `${name}, ${tracking}. Open the history`;
  }

  public static readonly aheadArrow: string = "↑";
  public static readonly behindArrow: string = "↓";

  public static formatAhead(ahead: number): string {
    return `${Resources.aheadArrow}${ahead}`;
  }

  public static formatAheadTitle(ahead: number): string {
    return `${ahead} ${ahead === 1 ? "commit" : "commits"} to push`;
  }

  public static formatBehindTitle(behind: number): string {
    return `${behind} ${behind === 1 ? "commit" : "commits"} to pull`;
  }

  public static formatRemoteAheadTitle(ahead: number): string {
    return `${ahead} ${ahead === 1 ? "commit" : "commits"} your branch doesn't have`;
  }

  public static formatRemoteBehindTitle(behind: number): string {
    return `${behind} ${behind === 1 ? "commit" : "commits"} on your branch it doesn't have`;
  }

  public static formatBehind(behind: number): string {
    return `${Resources.behindArrow}${behind}`;
  }

  public static formatHistoryTitle(folder: string): string {
    const name: string = folder.replace(/[\\/]+$/u, "").replace(/^.*[\\/]/u, "");
    return name.length === 0 ? Resources.historyTitleFallback : name;
  }

  public static formatAgeMinutes(minutes: number): string {
    return `${minutes} min ago`;
  }

  public static formatAgeHours(hours: number): string {
    return `${hours} h ago`;
  }

  public static formatChangedFiles(count: number): string {
    return count === 1 ? "1 changed file" : `${count} changed files`;
  }

  public static readonly commitIdLength: number = 12;
  public static readonly copyIdLabel: string = "Copy commit id";
  public static readonly copyIcon: IconName = "content_copy";
  public static readonly moreActionsLabel: string = "More actions";
  public static readonly moreIcon: IconName = "more_horiz";
  public static readonly createBranchHereLabel: string = "Create branch here";
  public static readonly createTagHereLabel: string = "Create tag here";
  public static readonly branchMenuIcon: IconName = "call_split";
  public static readonly parentLabel: string = "Parent";
  /** Leads the labels on the commit, after its parents. */
  public static readonly inLabel: string = "· In";

  public static formatShowParent(id: string): string {
    return `Show ${id} in the history`;
  }
  public static readonly noParent: string = "None: the first commit";
  public static readonly cherryPickLabel: string = "Cherry-pick";
  public static readonly cherryPickIcon: IconName = "copy_all";
  public static readonly revertLabel: string = "Revert";
  public static readonly predictedPathsShown: number = 3;
  public static readonly revertIcon: IconName = "undo";
  public static readonly branchHereLabel: string = "Branch here";
  public static readonly explainLabel: string = "Explain";
  public static readonly explainIcon: IconName = "stars_2";
  public static readonly fileLayoutLabel: string = "Show files as";
  public static readonly fileLayoutLabels: Readonly<Record<GitFileLayout, string>> = {
    [GitFileLayout.Tree]: "Tree",
    [GitFileLayout.Folders]: "Folders",
    [GitFileLayout.List]: "List"
  };
  public static readonly fileLayoutIcons: Readonly<Record<GitFileLayout, IconName>> = {
    [GitFileLayout.Tree]: "account_tree",
    [GitFileLayout.Folders]: "folder_open",
    [GitFileLayout.List]: "list"
  };
  public static readonly fileLayouts: readonly GitFileLayout[] = [GitFileLayout.Tree, GitFileLayout.Folders, GitFileLayout.List];
  /** A file list row's own start padding in rem, where a folder's open icon starts. */
  public static readonly rowStartRem: number = 0.25;
  /** How far each level of a commit's files steps in, in rem: a folder's open icon and the gap after it. */
  public static readonly commitFileStepRem: number = 1.5;
  /** How far each level of a file group steps in, in rem: a folder's open icon and the gap after it. */
  public static readonly groupFileStepRem: number = 1.375;
  public static readonly commitFilesLoading: string = "Reading the commit's files…";
  public static readonly commitFilesCut: string = "Git listed only part of this commit's files.";
  /** The sign before a count of removed lines: a true minus sign, where a diff line keeps Git's hyphen. */
  public static readonly removedSign: string = "−";
  /** Git's empty tree, which a first commit's changes are read against, for SHA-1 and SHA-256 repositories. */
  public static readonly emptyTreeSha1: string = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
  public static readonly emptyTreeSha256: string = "6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321";
  public static readonly changeLetters: Readonly<Record<FileChange, string>> = {
    Added: "A", Modified: "M", Deleted: "D", Renamed: "R", Copied: "C", TypeChanged: "T", Conflict: "U"
  };
  public static readonly messageCut: string = " …";
  public static readonly branchHereTitle: string = "Make a branch at this commit without switching to it";
  public static readonly branchNameLabel: string = "New branch name";
  public static readonly createLabel: string = "Create";
  public static readonly cancelLabel: string = "Cancel";
  public static readonly tagHereLabel: string = "Tag";
  public static readonly tagHereTitle: string = "Make a tag at this commit";
  public static readonly tagNameLabel: string = "New tag name";
  public static readonly switchLabel: string = "Switch to branch";
  public static readonly switchIcon: IconName = "swap_horiz";
  public static readonly openInBrowserLabel: string = "Open in browser";
  public static readonly copyLinkLabel: string = "Copy link";
  public static readonly copyLinkIcon: IconName = "link";
  public static readonly renameLabel: string = "Rename…";
  public static readonly renameIcon: IconName = "edit";
  public static readonly deleteLabel: string = "Delete";
  public static readonly deleteIcon: IconName = "delete";
  public static readonly cherryPickTitle: string = "Apply this commit's change onto the current branch as a new commit";
  public static readonly revertTitle: string = "Make a new commit on the current branch that undoes this commit's change";
  public static readonly authoredFormat: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };

  public static formatFilesChanged(count: number): string {
    return count === 1 ? "1 file changed" : `${count} files changed`;
  }

  /** A renamed or copied file's change letter with how alike Git found it to the file it came from, such as "R 92%". */
  public static formatSimilarity(letter: string, similarity: number): string {
    return `${letter} ${similarity}%`;
  }

  public static formatMovedFrom(path: string): string {
    return ` from ${path}`;
  }

  public static readonly peopleSeparator: string = " · ";
  public static readonly signatureIcons: Readonly<Record<SignatureState, IconName>> = { Verified: "verified", Unverified: "gpp_maybe", None: "remove_moderator" };

  /** A signed commit's signature line; an unsigned commit has none. */
  public static formatSignature(state: SignatureState, signer: string | null): string {
    const by: string = Object.isNull(signer) ? "" : ` by ${signer}`;
    return state === SignatureState.Verified ? `Signed${by}, verified against the keys you trust` : `Signed${by}, but the signature isn't verified`;
  }

  public static readonly commitPullRequestIcon: IconName = "alt_route";
  public static readonly commitCommentsIcon: IconName = "forum";

  /** The row that opens a commit's review comments on its host, with a "+" when the host's answer was cut. */
  public static formatCommitComments(count: number, isCapped: boolean): string {
    const shown: string = `${count}${isCapped ? "+" : ""}`;
    return count === 1 && !isCapped ? "1 review comment on this commit" : `${shown} review comments on this commit`;
  }
  /** Where the pull request that brought a commit in stands, after its title on the commit's card. */
  public static readonly commitPullRequestStates: Readonly<Record<GitPullRequestState, string>> = {
    [GitPullRequestState.Open]: "Open",
    [GitPullRequestState.Draft]: "Draft",
    [GitPullRequestState.Merged]: "Merged",
    [GitPullRequestState.Closed]: "Closed"
  };

  /** The commit's pull request card's note, such as "2 approvals · 6 of 6 checks passed": its approvals, then its failing, running or passed checks. */
  public static formatCommitPullRequestNote(approvals: number, passed: number, failing: number, pending: number): string {
    const total: number = passed + failing + pending;
    const parts: string[] = approvals === 0 ? [] : [approvals === 1 ? "1 approval" : `${approvals} approvals`];
    if (failing > 0)
      parts.push(`${failing} of ${total} checks failed`);
    else if (pending > 0)
      parts.push(`${pending} of ${total} checks running`);
    else if (passed > 0)
      parts.push(`${passed} of ${total} checks passed`);
    return parts.join(Resources.peopleSeparator);
  }

  public static formatCommitted(committer: string, date: string): string {
    return `committed by ${committer} ${date}`;
  }

  public static formatAuthored(date: string): string {
    return `authored ${date}`;
  }

  public static formatCommitLabel(shortId: string): string {
    return `Commit ${shortId}`;
  }

  public static readonly conflictsDocumentName: string = "git.conflicts";
  public static readonly conflictsTitle: string = "Conflicts";
  public static readonly conflictFilesLabel: string = "Files in the operation";
  public static readonly conflictIcon: IconName = "warning";
  public static readonly resolvedTitle: string = "Resolved";
  public static readonly resolvedIcon: IconName = "check_circle";
  public static readonly mergedCleanlyTitle: string = "Merged cleanly";
  public static readonly cleanFileIcon: IconName = "description";
  public static readonly commitDetailLabel: string = "Commit";
  /** The Commit view, beside the documents, which shows the commit the history document in front chose. */
  public static readonly commitDetailViewName: string = "git.commitView";
  /** The Commit view's one instance, which every history document shows its commit in. */
  public static readonly commitDetailViewInstance: string = "selected";
  public static readonly commitDetailIcon: IconName = "commit";
  /** In the right dock's first group, after the Git panel and the hosts' detail views, before the Conflict view. */
  public static readonly commitDetailDefaultGroup: number = 0;
  public static readonly commitDetailDefaultOrder: number = 45;
  public static readonly commitDetailEmpty: string = "Choose a commit in History to see it here";
  public static readonly conflictDetailLabel: string = "Conflict";
  /** The Conflict view, beside the documents, which shows the current conflict of the conflicts document in front. */
  public static readonly conflictDetailViewName: string = "git.conflictDetail";
  /** The Conflict view's one instance, which every conflicts document shows its conflict in. */
  public static readonly conflictDetailViewInstance: string = "selected";
  /** In the right dock's first group, after the Git panel and the hosts' detail views. */
  public static readonly conflictDetailDefaultGroup: number = 0;
  public static readonly conflictDetailDefaultOrder: number = 50;
  public static readonly conflictDetailEmpty: string = "Open the conflicts of a merge or rebase to see the conflict here.";
  public static readonly rebasePreviewLabel: string = "Rebase preview";
  /** The Rebase preview view, beside the documents, which shows the interactive rebase document in front as its branch will be after. */
  public static readonly rebasePreviewViewName: string = "git.rebasePreview";
  /** The Rebase preview view's one instance, which every rebase document shows its preview in. */
  public static readonly rebasePreviewViewInstance: string = "selected";
  public static readonly rebasePreviewIcon: IconName = "low_priority";
  /** In the right dock's first group, after the Conflict view. */
  public static readonly rebasePreviewDefaultGroup: number = 0;
  public static readonly rebasePreviewDefaultOrder: number = 60;
  public static readonly rebasePreviewEmpty: string = "Open an interactive rebase to preview it.";
  /** The Across repositories view, beside the documents, which shows what spans the repositories of the workspace page in front. */
  public static readonly workspaceAcrossViewName: string = "git.workspaceAcross";
  /** The Across repositories view's one instance, which every workspace page shows its repositories in. */
  public static readonly workspaceAcrossViewInstance: string = "selected";
  public static readonly workspaceAcrossIcon: IconName = "hub";
  /** In the right dock's first group, after the Rebase preview view. */
  public static readonly workspaceAcrossDefaultGroup: number = 0;
  public static readonly workspaceAcrossDefaultOrder: number = 70;
  public static readonly workspaceAcrossEmpty: string = "Open a workspace to see its repositories together here.";
  public static readonly beforeCommitTitle: string = "Before you commit";
  public static readonly baseTitle: string = "Base";
  /** The base is missing when both sides added the text, so there is nothing they changed from. */
  public static readonly noBaseNote: string = "No base: both sides added this text.";
  public static readonly noMarkersLeft: string = "No conflict markers left in resolved files";
  /** Git's recorded resolutions are on for every merge, cherry-pick, revert and rebase the module runs. */
  public static readonly rerereNote: string = "Resolutions are remembered (rerere), so the same conflict resolves itself the next time it comes up.";
  /** How many files merged cleanly the Conflicts screen lists before a row that shows the rest. */
  public static readonly shownCleanFiles: number = 2;
  public static readonly oursLabel: string = "Ours";
  public static readonly theirsLabel: string = "Theirs";
  public static readonly takeOursLabel: string = "Take all ours";
  public static readonly takeTheirsLabel: string = "Take all theirs";
  public static readonly deleteFileLabel: string = "Delete the file";
  public static readonly resultLabel: string = "Result";
  public static readonly resultIcon: IconName = "edit";
  public static readonly showBaseLabel: string = "Show base";
  public static readonly baseIcon: IconName = "history";
  /** The base pane's note: the version both sides started from. */
  public static readonly baseNote: string = "where both sides started";
  public static readonly previousConflictLabel: string = "Previous";
  public static readonly previousConflictIcon: IconName = "arrow_upward";
  public static readonly nextConflictLabel: string = "Next conflict";
  public static readonly nextConflictIcon: IconName = "arrow_downward";
  public static readonly markResolvedLabel: string = "Mark resolved";
  public static readonly deletedOnThisSide: string = "This side deleted the file.";
  public static readonly reusedNote: string = "Git reused a recorded resolution of this conflict. Check it before you keep it.";
  public static readonly binaryNote: string = "This file is binary: keep one side's whole file.";
  public static readonly noOperation: string = "No merge, rebase, cherry-pick or revert is in progress.";
  public static readonly otherFolderNote: string = "Open this folder in the Git panel to resolve its conflicts.";
  public static readonly abortOperationIcon: IconName = "close";
  public static readonly continueOperationIcon: IconName = "check";

  public static readonly abortLabels: Readonly<Record<OperationKind, string>> = {
    Merge: "Abort merge", Rebase: "Abort rebase", CherryPick: "Abort cherry-pick", Revert: "Abort revert"
  };

  public static readonly operationNouns: Readonly<Record<OperationKind, string>> = {
    Merge: "merge", Rebase: "rebase step", CherryPick: "cherry-pick", Revert: "revert"
  };

  public static readonly commitOperationLabels: Readonly<Record<OperationKind, string>> = {
    Merge: "Commit the merge", Rebase: "Commit the rebase step", CherryPick: "Commit the cherry-pick", Revert: "Commit the revert"
  };

  public static readonly continueLabels: Readonly<Record<OperationKind, string>> = {
    Merge: "Commit the merge", Rebase: "Continue the rebase", CherryPick: "Commit the cherry-pick", Revert: "Commit the revert"
  };

  /** How the file list names each resolution beside a resolved file. */
  public static readonly resolutionNotes: Readonly<Record<GitResolvedBy, string>> = { Ours: "ours", Theirs: "theirs", Both: "both", Edited: "edited", Deleted: "deleted" };

  /** The detail panel's title for the merge editor's active conflict, such as "Conflict 2 of 2". */
  public static formatConflictTitle(conflict: number, conflicts: number): string {
    return `Conflict ${conflict} of ${conflicts}`;
  }

  /** Where the active conflict sits in the result, counted from 1, such as "lines 38 to 40" or "line 12". */
  public static formatConflictLines(first: number, last: number): string {
    return first === last ? `line ${first}` : `lines ${first} to ${last}`;
  }

  /** The files out of conflict that still have a conflict marker line, such as "Conflict markers left in a.ts and b.ts". */
  public static formatMarkersLeft(paths: readonly string[]): string {
    const names: string = paths.length === 1 ? paths.join("") : `${paths.slice(0, -1).join(", ")} and ${paths.slice(-1).join("")}`;
    return `Conflict markers left in ${names}`;
  }

  public static formatMarkerCheckFailed(message: string): string {
    return `The check for conflict markers failed: ${message}`;
  }

  /** An open file's resolved conflicts out of all of them, such as "1 of 2". */
  public static formatConflictProgress(resolved: number, conflicts: number): string {
    return `${resolved} of ${conflicts}`;
  }

  /**
   * What follows a side's name in its pane head, its commit's short id, such as " · 3b9f001" after "main"; null when the side has no commit or its name
   * already ends with that id, such as "your commit 3b9f001".
   */
  public static formatSideCommit(label: string, commit: string | null): string | null {
    const shortId = commit?.slice(0, Resources.shortIdLength) ?? label;
    return label.endsWith(shortId) ? null : ` · ${shortId}`;
  }

  /** The result pane's note, with whether each conflict is resolved, such as "editable · conflict 1 resolved, conflict 2 open". */
  public static formatResultNote(resolved: readonly boolean[]): string {
    return ["editable", ...(resolved.length === 0 ? [] : [resolved.map((t, i) => `conflict ${i + 1} ${t ? "resolved" : "open"}`).join(", ")])].join(" · ");
  }

  /** The row under the first files merged cleanly that shows the rest, such as "7 more". */
  public static formatMoreCleanFiles(count: number): string {
    return `${count} more`;
  }

  public static formatResolvedCount(resolved: number, files: number): string {
    return `${resolved} of ${files} ${files === 1 ? "file" : "files"} resolved`;
  }

  /** What follows a predicted conflict's file badges when it names more files than they show, such as "+2 more". */
  public static formatMorePaths(count: number): string {
    return `+${count} more`;
  }

  /** One line on what an action would do on the current branch, without the files a conflict names, which follow it as badges; `null` when Git can't tell. */
  public static formatPrediction(action: string, prediction: GitPrediction | null): string | null {
    switch (prediction?.outcome) {
      case PredictionOutcome.UpToDate:
        return `${action}: already on this branch.`;
      case PredictionOutcome.FastForward:
      case PredictionOutcome.Clean:
        return `${action} applies cleanly.`;
      case PredictionOutcome.Conflicts:
        return `${action} would conflict in ${Resources.formatCount(prediction.paths.length)} ${prediction.paths.length === 1 ? "file" : "files"}`;
      default:
        return null;
    }
  }

  public static formatConflictsTitle(folder: string): string {
    return `${Resources.conflictsTitle}: ${Resources.formatHistoryTitle(folder)}`;
  }

  public static readonly recentActionsLabel: string = "Recent actions";
  public static readonly noRecentActions: string = "No actions yet";
  public static readonly forcePushOfferLabel: string = "Force push\u2026";
  public static readonly forcePushTitle: string = "Force push with lease?";
  public static readonly forcePushLabel: string = "Force push";
  public static readonly switchMergeTitle: string = "Switch and merge?";
  public static readonly switchMergeLabel: string = "Switch and merge";
  /** What each write of the journal did, by its method; a method not listed shows by its name. */
  public static readonly recentActionNames: Readonly<Record<string, string>> = {
    "git.stage": "Stage", "git.unstage": "Unstage", "git.discard": "Discard", "git.createBranch": "Create a branch", "git.switchBranch": "Switch branch",
    "git.commit": "Commit", "git.amend": "Amend the last commit", "git.push": "Push", "git.pull": "Pull", "git.cherryPick": "Cherry-pick", "git.revert": "Revert",
    "git.createBranchAt": "Create a branch at a commit", "git.renameBranch": "Rename a branch", "git.deleteBranch": "Delete a branch", "git.createTag": "Tag",
    "git.deleteTag": "Delete a tag", "git.stageLines": "Stage lines", "git.unstageLines": "Unstage lines", "git.undo": "Undo", "git.reset": "Reset",
    "git.undoCommit": "Undo the last commit", "git.forcePush": "Force push", "git.resolveConflict": "Resolve a conflict", "git.continueOperation": "Continue",
    "git.abortOperation": "Abort", "git.merge": "Merge", "git.stash": "Stash"
  };

  public static readonly fetchOfferLabel: string = "Fetch";
  public static formatForcePushText(branch: string, upstream: string, shortId: string): string {
    return `This replaces the commits ${upstream} has that ${branch} doesn't with ${branch}'s, only while ${upstream} still points at ${shortId}, `
      + `as the last fetch saw it. If anyone pushed since, the remote refuses it and nothing changes.`;
  }

  public static formatRecentAction(method: string, branch: string | null): string {
    const name: string = Resources.recentActionNames[method] ?? method;
    return Object.isNull(branch) ? name : `${name} on ${branch}`;
  }

  public static readonly rebaseDocumentName: string = "git.interactiveRebase";
  public static readonly squashPrefix: string = "squash! ";
  public static readonly messageLineEnd: string = "\n";
  public static readonly headLabel: string = "HEAD";
  public static readonly rebaseNoTarget: string = "Open a commit's detail and choose Rebase onto here to start a rebase.";
  public static readonly dragType: string = "text/plain";
  /** A transparent image the rebase screen drags in place of the browser's picture of the row, since it draws the row's card itself. */
  public static readonly blankDragImage: string = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  public static readonly checkingIcon: IconName = "progress_activity";
  public static readonly okTone: string = "ok";
  public static readonly warningTone: string = "warning";
  public static readonly mutedTone: string = "muted";
  public static readonly warningIcon: IconName = "warning";
  public static readonly rebaseTitle: string = "Rebase";
  public static readonly rebaseIcon: IconName = "low_priority";
  public static readonly dropRebaseIcon: IconName = "low_priority";
  public static readonly dropRequestIcon: IconName = "alt_route";
  public static readonly dropCleanIcon: IconName = "check_circle";
  public static readonly dropCheckingIcon: IconName = "progress_activity";
  public static readonly dropChecking: string = "Checking for conflicts…";
  public static readonly dropClean: string = "No conflicts predicted";
  public static readonly dropUpToDate: string = "Already merged";

  public static formatDropTitle(source: string, target: string): string {
    return `Drop ${source} on ${target}`;
  }

  public static formatDropConflicts(paths: readonly string[]): string {
    return `Conflicts predicted in ${Resources.formatCount(paths.length)} ${paths.length === 1 ? "file" : "files"}: ${paths.slice(0, Resources.predictedPathsShown).join(", ")}${
      paths.length > Resources.predictedPathsShown ? ` and ${Resources.formatCount(paths.length - Resources.predictedPathsShown)} more` : ""}`;
  }

  public static formatDropChecked(canMerge: boolean, source: string, target: string): string {
    return `Checked against ${canMerge ? target : source} without touching your files.`;
  }

  public static readonly dropSameCommit: string = "Both point at the same commit.";

  public static formatDropUnpredicted(source: string, target: string): string {
    return `Switch to ${source} or ${target} to see what a merge of the two would do.`;
  }

  public static formatDropMerge(source: string, target: string): string {
    return `Merge ${source} into ${target}`;
  }

  public static formatDropMergeNeedsSwitch(target: string): string {
    return `Switch to ${target} to merge into it`;
  }

  public static formatDropSwitchMerge(source: string, target: string): string {
    return `Switch to ${target} and merge ${source}`;
  }

  public static formatSwitchMergeText(source: string, target: string): string {
    return `Git first switches to ${target}, then merges ${source} into it. You stay on ${target} afterwards.`;
  }

  public static formatSwitchMergeChanges(target: string): string {
    return `Commit or stash your changes first: switching to ${target} to merge would carry them along.`;
  }

  public static formatDropRebase(source: string, target: string): string {
    return `Rebase ${source} onto ${target}`;
  }

  public static formatDropRebaseNeedsSwitch(source: string): string {
    return `Switch to ${source} to rebase it`;
  }

  public static formatDropRequest(target: string): string {
    return `Open a pull request into ${target}`;
  }

  public static formatDropRequestNeedsHost(source: string, target: string): string {
    return `Push ${source} to a remote whose host opens pull requests to open one into ${target}`;
  }

  public static readonly mergeLabel: string = "Merge";
  public static readonly mergeTitle: string = "Merge this branch into the current branch";
  public static readonly rebaseHereLabel: string = "Rebase onto here";
  public static readonly rebaseHereTitle: string = "Rebase the current branch onto this commit, choosing what happens to each of its commits.";
  public static readonly rebaseScreenLabel: string = "Interactive rebase";
  public static readonly rebaseHint: string = "Drag a row or press Alt+↑ and Alt+↓ to reorder. P, R, E, S, F and D set a row's action. Each row is checked against the commits before it, so you see a conflict before you start.";
  public static readonly tidyUpLabel: string = "Tidy up for review";
  public static readonly tidyUpIcon: IconName = "stars_2";
  public static readonly actionColumn: string = "Action";
  public static readonly commitColumn: string = "Commit";
  public static readonly messageColumn: string = "Message";
  public static readonly checkColumn: string = "Check";
  public static readonly dragIcon: IconName = "drag_indicator";
  public static readonly rebaseActionTitles: Readonly<Record<RebaseAction, string>> = {
    Pick: "Pick", Reword: "Reword", Edit: "Edit", Squash: "Squash", Fixup: "Fixup", Drop: "Drop"
  };
  /** The key that sets each action on the selected row. */
  public static readonly rebaseActionKeys: Readonly<Record<string, RebaseAction>> = {
    p: "Pick", r: "Reword", e: "Edit", s: "Squash", f: "Fixup", d: "Drop"
  };
  public static readonly rebaseMessageLabel: string = "New message";
  public static readonly checkingLabel: string = "Checking…";
  public static readonly appliesCleanly: string = "Applies cleanly";
  public static readonly leftOut: string = "Left out";
  public static readonly notChecked: string = "Not checked on this git";
  /** What a dragged row's card says where it would apply cleanly, and where its place would leave a fold first. */
  public static readonly droppedClean: string = "clean";
  public static readonly droppedRefused: string = "nothing before it to fold into";
  /** The most places the advice after the summary tries for the conflicting row, nearest first, one check each. */
  public static readonly advicePlaces: number = 20;
  public static readonly checkIcons: Readonly<Record<RebaseCheckOutcome, IconName>> = {
    Clean: "check_circle", Conflicts: "warning", Folded: "merge_type", Dropped: "do_not_disturb_on", Unavailable: "help"
  };
  public static readonly moveStackedLabel: string = "Move stacked branches with it";
  public static readonly foldFixupsLabel: string = "Fold fixup! commits into their targets";
  public static readonly undoBackLabel: string = "Undo puts the branch back as it was, once the rebase finishes";
  public static readonly undoBackTitle: string =
    "Always on: a finished rebase is in the Undo menu, which puts the branch and the stacked branches it moved back where they were. A rebase that stops on a conflict goes back with Abort rebase.";
  public static readonly runTestsLabel: string = "Run the tests after each commit";
  public static readonly runTestsNote: string = "stops at the first commit that fails";
  public static readonly startRebaseLabel: string = "Start rebase";
  public static readonly startIcon: IconName = "play_arrow";
  public static readonly nowLabel: string = "Now";
  public static readonly afterLabel: string = "After";
  public static readonly movedTooLabel: string = "moved too";
  public static readonly showConflictLabel: string = "Show the conflict now";
  public static readonly showConflictWaits: string = "Opens the conflict once the rebase stops on it";
  public static readonly foldFirstRefusal: string = "The first kept commit can't be squashed or fixed up, since there's nothing before it to fold into.";
  public static readonly pushedNote: string = "The branch has been pushed. After the rebase, Push will offer a force push with lease, which refuses if someone else pushed meanwhile.";
  public static readonly emptyRebase: string = "The branch has no commits past this one to rebase.";

  public static formatRebaseHeading(count: number, branch: string | null, onto: string): string {
    return `Rebase ${Resources.formatCount(count)} ${count === 1 ? "commit" : "commits"} of ${branch ?? "the detached HEAD"} onto ${onto}`;
  }

  public static formatRebaseDocumentTitle(folder: string): string {
    return `${Resources.rebaseTitle}: ${Resources.formatHistoryTitle(folder)}`;
  }

  public static formatFoldsInto(id: string): string {
    return `Folds into ${id}`;
  }

  public static formatConflictsIn(paths: readonly string[]): string {
    return `Conflicts in ${paths.join(", ")}`;
  }

  public static formatStackedFollow(names: readonly string[]): string {
    return `${names.join(", ")} ${names.length === 1 ? "follows" : "follow"}`;
  }

  /** A dragged row's check where it would drop, such as "Dropped here: conflicts in a.ts". */
  public static formatDroppedHere(check: string): string {
    return `Dropped here: ${check.charAt(0).toLowerCase()}${check.slice(1)}`;
  }

  /** Where to drop the conflicting row to clear its conflict: below the row named, or to the top when `above` is `null`. */
  public static formatDropAdvice(id: string, above: string | null, paths: readonly string[]): string {
    return `dropping ${id} ${Object.isNull(above) ? "to the top" : `below ${above}`} clears the conflict in ${paths.join(", ")}`;
  }

  /** How the advice names a fold the conflicting row would drop below, by its action's title, such as "the fixup". */
  public static formatTheFold(action: string): string {
    return `the ${action.toLowerCase()}`;
  }

  public static formatWithAdvice(summary: string, advice: string): string {
    return `${summary} · ${advice}`;
  }

  public static formatCommitsBecome(before: number, after: number): string {
    return `${before} ${before === 1 ? "commit becomes" : "commits become"} ${after}`;
  }

  public static formatCommitsFrom(count: number, base: string): string {
    return `${count} ${count === 1 ? "commit" : "commits"} from ${base}`;
  }

  public static formatAheadOfBase(count: number): string {
    return `${count} ${count === 1 ? "commit" : "commits"} ahead of the base`;
  }

  public static formatStepStops(step: number): string {
    return `Step ${step} will stop on a conflict`;
  }

  /** The stop card's note, as the board writes it: the files that conflict, the branch they changed on, and the step's own commit that changes the same lines. */
  public static formatStepStopsNote(paths: readonly string[], onto: string, commit: string): string {
    return `${paths.join(", ")} changed on ${onto}. The same lines change in ${commit}. You can resolve it when the rebase stops, or move or drop this commit.`;
  }

  public static formatSquashMessage(leader: string, folded: string): string {
    return `${leader}\n\n${folded}`;
  }

  public static readonly workspaceDocumentName: string = "git.workspace";
  public static readonly openWorkspaceCommand: string = "git.openWorkspace";
  /** The workspace page's instance that lists the repositories opened lately rather than a workspace's. */
  public static readonly openRepositoriesInstance: string = "open";
  /** The page of the repositories opened lately: its tab, heading and entry beside the workspaces. */
  public static readonly dashboardTitle: string = "Dashboard";
  public static readonly openDashboardTitle: string = "Open dashboard";
  public static readonly dashboardIcon: IconName = "dashboard";
  public static readonly workspaceIcon: IconName = "workspaces";
  public static readonly addIcon: IconName = "add";
  public static readonly fetchAllIcon: IconName = "download";
  public static readonly moveUpIcon: IconName = "arrow_upward";
  public static readonly moveDownIcon: IconName = "arrow_downward";
  public static readonly removeIcon: IconName = "close";
  public static readonly filterIcon: IconName = "filter_list";
  public static readonly workspacesHeading: string = "Workspaces";
  public static readonly newWorkspaceTitle: string = "New workspace";
  public static readonly renameWorkspaceTitle: string = "Rename workspace";
  public static readonly removeWorkspaceTitle: string = "Remove workspace";
  public static readonly workspaceNameLabel: string = "Workspace name";
  public static readonly fetchAllTitle: string = "Fetch all";
  public static readonly addRepositoryTitle: string = "Add repository…";
  public static readonly moveUpTitle: string = "Move up";
  public static readonly moveDownTitle: string = "Move down";
  public static readonly filterRepositoriesLabel: string = "Filter repositories";
  public static readonly selectRepositoryLabel: string = "Select";
  public static readonly repositoryColumn: string = "Repository";
  public static readonly branchColumn: string = "Branch";
  public static readonly syncColumn: string = "Sync";
  public static readonly changesColumn: string = "Changes";
  public static readonly fetchedColumn: string = "Fetched";
  public static readonly pullRequestColumn: string = "Pull request";
  public static readonly checksColumn: string = "Checks";
  public static readonly openColumn: string = "Open";
  /** The branch has no pull request, or no host reads the repository's pull requests. */
  public static readonly noPullRequest: string = "None";
  public static readonly pullRequestSignedOut: string = "Sign in";
  public static readonly pullRequestUnavailable: string = "Unavailable";
  public static readonly checksFailing: string = "Failing";
  public static readonly checksRunning: string = "Running";
  public static readonly checksPassing: string = "Passing";
  public static readonly noChecks: string = "None";
  /** A branch's pull request's state, after its number on the workspace page. */
  public static readonly workspacePullRequestStates: Readonly<Record<GitPullRequestState, string>> = {
    [GitPullRequestState.Open]: "open",
    [GitPullRequestState.Draft]: "draft",
    [GitPullRequestState.Merged]: "merged",
    [GitPullRequestState.Closed]: "closed"
  };
  public static readonly neverFetched: string = "Never";
  public static readonly noRepositories: string = "No repositories here yet.";
  public static readonly noRepositoryMatches: string = "No repository matches the filter.";
  public static readonly upToDate: string = "Up to date";
  public static readonly noUpstreamShort: string = "No upstream";
  public static readonly upstreamGone: string = "Upstream gone";
  public static readonly changesTruncated: string = "Changes";
  public static readonly clean: string = "Clean";
  public static readonly fetching: string = "Fetching…";
  public static readonly noCommitsYet: string = "No commits yet";
  public static readonly workspaceViewsHeading: string = "Views";
  public static readonly workspaceHostsHeading: string = "Hosts";
  /** Each view's icon and name in the workspace page's side panel. */
  public static readonly workspaceViews: Readonly<Record<GitWorkspaceView, GitWorkspaceViewLabel>> = {
    [GitWorkspaceView.Behind]: new GitWorkspaceViewLabel("sync_problem", "Behind their upstream"),
    [GitWorkspaceView.Changed]: new GitWorkspaceViewLabel("edit_note", "With uncommitted changes"),
    [GitWorkspaceView.WaitingForReview]: new GitWorkspaceViewLabel("rate_review", "Waiting for review"),
    [GitWorkspaceView.AgentsAtWork]: new GitWorkspaceViewLabel("smart_toy", "Agents at work")
  };
  public static readonly hostSignedIn: string = "signed in";
  public static readonly hostSignIn: string = "Sign in";
  /** The remotes no host claims, by how Git reaches them. */
  public static readonly plainGitHosts: Readonly<Record<RemoteTransport, string>> = {
    [RemoteTransport.Ssh]: "Plain Git over SSH",
    [RemoteTransport.Https]: "Plain Git over HTTPS",
    [RemoteTransport.File]: "Plain Git in a folder",
    [RemoteTransport.Other]: "Plain Git"
  };

  public static formatRemoteCount(count: number): string {
    return count === 1 ? "1 remote" : `${count} remotes`;
  }

  public static formatHostSettings(host: string): string {
    return `Open ${host} in Accounts and hosts`;
  }

  public static formatRepositoryCount(count: number, selected: number): string {
    const repositories: string = count === 1 ? "1 repository" : `${count} repositories`;
    return selected === 0 ? repositories : `${repositories} · ${selected} selected`;
  }

  /**
   * A branch's pull request as the workspace shows it, such as "#214 open", "#1046 draft", "#22 merged", or "Review #533" when it waits for its reviews;
   * with the host's own word for its state when it gives one, such as "!22 completed".
   */
  public static formatWorkspacePullRequest(label: string, state: GitPullRequestState, isWaitingForReview: boolean, stateLabel: string | null = null): string {
    if (state === GitPullRequestState.Open && isWaitingForReview)
      return `Review ${label}`;
    return `${label} ${stateLabel?.toLowerCase() ?? Resources.workspacePullRequestStates[state]}`;
  }

  public static formatRemoveRepositories(count: number): string {
    return `Remove ${count}`;
  }

  public static formatSync(ahead: number, behind: number): string {
    const parts: readonly string[] = [ahead > 0 ? Resources.formatAhead(ahead) : "", behind > 0 ? Resources.formatBehind(behind) : ""].filter(t => t.length > 0);
    return parts.length === 0 ? Resources.upToDate : parts.join(" ");
  }

  public static formatChangedFileCount(files: number, isTruncated: boolean): string {
    if (files === 0)
      return isTruncated ? Resources.changesTruncated : Resources.clean;
    return files === 1 && !isTruncated ? "1 file" : `${files}${isTruncated ? "+" : ""} files`;
  }

  public static formatConflicts(conflicts: number): string {
    return conflicts === 1 ? "1 conflict" : `${conflicts} conflicts`;
  }

  public static readonly acrossHeading: string = "Across repositories";
  public static readonly needsYouHeading: string = "Needs you";
  public static readonly agentsAtWorkHeading: string = "Agents at work";
  public static readonly nothingNeedsYou: string = "Nothing across these repositories needs you.";
  public static readonly sharedBranchIcon: IconName = "link";
  public static readonly behindIcon: IconName = "sync_problem";
  public static readonly reviewIcon: IconName = "rate_review";
  public static readonly openLabel: string = "Open";
  public static readonly reviewLabel: string = "Review";
  public static readonly pushAllLabel: string = "Push all";
  public static readonly ownWorktree: string = "own worktree";
  public static readonly pushedVerb: string = "Pushed";
  public static readonly pulledVerb: string = "Pulled";
  /** Why a bulk push skipped a repository: its branch has no upstream, and the push never sets one. */
  public static readonly bulkNoUpstream: string = "it has no upstream on its remote";
  public static readonly bulkBranchChanged: string = "its branch, upstream or remote changed since you confirmed";
  public static readonly bulkNotBehind: string = "it is no longer only behind its upstream";
  public static readonly stackIcon: IconName = "stacks";
  public static readonly bulkBranchNameRefused: string = "Git doesn't take that branch name";
  public static readonly newBranchIcon: IconName = "call_split";
  public static readonly newBranchText: string = "Each repository gets the branch at its current commit and switches to it:";
  public static readonly branchNameRefused: string = "Git doesn't take this as a branch name.";

  private static readonly countWords: readonly string[] = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

  /** A count in a sentence or a button: a word from one to nine and digits otherwise, such as "three" or "12". */
  public static formatCount(count: number): string {
    return Resources.countWords[count - 1] ?? String(count);
  }

  /** A count that starts a sentence, such as "Three" or "12". */
  public static formatCountStart(count: number): string {
    const text: string = Resources.formatCount(count);
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  }

  /** Names in a sentence, such as "git", "git and terminal" or "ui-components, git and terminal". */
  public static formatNames(names: readonly string[]): string {
    return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.slice(-1).join("")}`;
  }

  public static formatSharedBranchTitle(count: number): string {
    return `One change in ${Resources.formatCount(count)} repositories`;
  }

  public static formatSharedBranchText(branch: string, repositories: readonly string[]): string {
    return `${branch} is open in ${Resources.formatNames(repositories)}.`;
  }

  public static formatOpenAll(count: number): string {
    return `Open all ${Resources.formatCount(count)}`;
  }

  public static readonly moreReviews: string = "More pull requests ask for your review than the host listed.";

  /** A pull request that asks the person for a review, such as "Review #533 · desktop", the reference followed by its title. */
  public static formatReviewRequest(label: string, repository: string): string {
    return `Review ${label} · ${repository}`;
  }

  public static formatAgentWaiting(repository: string, name: string): string {
    return `Agent in ${repository} waits: ${name}`;
  }

  public static formatRepositoryConflicts(repository: string, conflicts: number): string {
    return `${repository}: ${Resources.formatCount(conflicts)} ${conflicts === 1 ? "conflict" : "conflicts"}`;
  }

  public static formatChecksFailing(repository: string, branch: string, failing: number): string {
    return `${repository} ${branch}: ${Resources.formatCount(failing)} ${failing === 1 ? "check" : "checks"} failing`;
  }

  public static formatBehindRepositories(count: number): string {
    return `${Resources.formatCountStart(count)} ${count === 1 ? "repository is" : "repositories are"} behind and can fast-forward`;
  }

  public static formatPullCount(count: number): string {
    return `Pull ${count}`;
  }

  public static formatRun(repository: string, name: string): string {
    return `${repository} · ${name}`;
  }

  public static formatFetchAllNote(atOnce: number): string {
    return `Fetch all runs ${Resources.formatCount(atOnce)} repositories at a time, in the background, and never changes a working folder.`;
  }

  public static formatPushAllTitle(branch: string): string {
    return `Push ${branch}?`;
  }

  public static readonly pushAllText: string = "Each push sends the branch to its upstream as the toolbar's Push does, never forced, with the repository's hooks; a failure stops only its own repository.";

  /** A repository a bulk push will push, such as "git: feature/kit to origin/feature/kit on github.com/example-owner/git". */
  public static formatPushTarget(repository: string, branch: string, upstream: string, remote: string | null): string {
    return `${repository}: ${branch} to ${upstream}${Object.isNull(remote) ? "" : ` on ${remote}`}`;
  }

  public static formatPushSkipped(repository: string, branch: string): string {
    return `${repository}: skipped, since ${branch} has no upstream on its remote`;
  }

  /** How a remote-tracking branch's name starts on the remote, such as "origin/". */
  public static formatRemotePrefix(remote: string): string {
    return `${remote}/`;
  }

  public static formatBulkBranchExists(name: string): string {
    return `it already has a branch ${name}`;
  }

  /** The verb a bulk branch's result line starts with, such as "Created feature/kit in" before the repositories' names. */
  public static formatBranchedVerb(name: string): string {
    return `Created ${name} in`;
  }

  public static formatPullChosen(count: number): string {
    return `Pull ${count}`;
  }

  public static formatNewBranchIn(count: number): string {
    return `New branch in ${count}`;
  }

  public static formatNewBranchTitle(count: number): string {
    return `New branch in ${Resources.formatCount(count)} ${count === 1 ? "repository" : "repositories"}`;
  }

  /** A pull request cell's tooltip, its whole text, which may end in an ellipsis, before the pull request's title. */
  public static formatPullRequestLinkTitle(text: string, title: string): string {
    return `${text}: ${title}`;
  }

  /** A stacked pull request's cell, such as "#215 open · on #214". */
  public static formatStackedOn(text: string, under: string): string {
    return `${text} · on ${under}`;
  }

  /** A stack's row, such as "git: #214, then #215: merge in order, #214 first". */
  public static formatStack(repository: string, labels: readonly string[]): string {
    return `${repository}: ${labels.join(", then ")}: merge in order, ${labels.slice(0, 1).join("")} first`;
  }

  public static formatBulkDone(verb: string, repositories: readonly string[]): string {
    return `${verb} ${Resources.formatNames(repositories)}.`;
  }

  public static formatBulkSkipped(repository: string, reason: string): string {
    return `Skipped ${repository}: ${reason}.`;
  }

  public static formatBulkFailed(repository: string, reason: string): string {
    return `${repository} failed: ${reason}`;
  }

  public static readonly pullRequestCommitsLabel: string = "Commits";
  public static readonly pullRequestNoCommits: string = "No commits.";
  public static readonly pullRequestCommitsCapped: string = "Showing the latest 250.";
  public static readonly pullRequestMoreMark: string = "+";
  public static readonly pullRequestCommitDateFormat: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  public static readonly pullRequestFilesLabel: string = "Files";
  public static readonly pullRequestNoFiles: string = "No changed files.";
  public static readonly pullRequestFilesOpenHint: string = "Open this repository in Git to see each file's changes.";
  public static readonly pullRequestFilesFetchHint: string = "Fetch to see each file's changes.";
  public static readonly pullRequestFilesFetchFailed: string = "The fetch didn't finish. Try again to see each file's changes.";
  /** The letter beside a file for what the pull request did to it, as the Git panel marks a change. */
  public static readonly pullRequestFileLetters: Readonly<Record<FileChangeKind, string>> = {
    [FileChangeKind.Added]: "A", [FileChangeKind.Modified]: "M", [FileChangeKind.Deleted]: "D", [FileChangeKind.Renamed]: "R"
  };
  public static readonly pullRequestConflictsLabel: string = "Conflicts";
  public static readonly pullRequestNoConflicts: string = "No conflicts.";
  public static readonly pullRequestConflictsCapped: string = "Showing the first 100.";

  public static formatHostRequestFailed(host: string, method: string, reason: string): string {
    return `The ${host} module's ${method} request failed: ${reason}`;
  }

  public static formatLinkFailed(url: string, reason: string): string {
    return `The Git view couldn't open ${url}: ${reason}`;
  }

  public static formatHostLinkFailed(host: string, url: string, reason: string): string {
    return `The ${host} module couldn't open ${url}: ${reason}`;
  }

  public static formatPullRequestCommitsReading(host: string): string {
    return `Reading the commits on ${host}.`;
  }

  public static formatPullRequestCommitsUnanswered(host: string): string {
    return `${host} didn't answer. Try again to read the commits.`;
  }

  public static formatPullRequestFilesReading(host: string): string {
    return `Reading the files on ${host}.`;
  }

  public static formatPullRequestFilesUnanswered(host: string): string {
    return `${host} didn't answer. Try again to read the files.`;
  }

  public static formatPullRequestConflictsReading(host: string): string {
    return `Reading the conflicts on ${host}.`;
  }

  public static formatPullRequestConflictsUnanswered(host: string): string {
    return `${host} didn't answer. Try again to read the conflicts.`;
  }

  public static formatPullRequestFileMovedFrom(path: string): string {
    return ` from ${path}`;
  }

  public static formatThreadsReading(host: string): string {
    return `Reading the comments on ${host}.`;
  }

  public static formatThreadsUnanswered(host: string): string {
    return `${host} didn't answer. Try again to read the comments.`;
  }

  public static formatThreadWriteUnanswered(host: string): string {
    return `${host} didn't answer, so nothing changed. Try again.`;
  }

  public static formatOlderComments(host: string): string {
    return `Showing the newest comments. Older ones are on ${host}.`;
  }

  public static formatOpenThreads(count: number): string {
    return count === 1 ? "1 open thread" : `${count} open threads`;
  }

  public static formatCommentCount(count: number): string {
    return count === 1 ? "1 comment" : `${count} comments`;
  }

  /** The thread head's words after its state, or the whole head for a thread without one: the file's name and line it comments on, when it has them. */
  public static formatThreadPlace(afterState: boolean, path: string | null, line: number | null): string {
    const comment: string = afterState ? " comment" : "Comment";
    if (Object.isNull(path))
      return comment;
    const name: string = path.slice(path.lastIndexOf("/") + 1);
    return Object.isNull(line) ? `${comment} on ${name}` : `${comment} on ${name}, line ${line}`;
  }

  public static formatPullRequestFilesCapped(count: number): string {
    return `Showing the first ${String(count)}.`;
  }

  public static formatOpenPullRequestConflict(path: string): string {
    return `Open the conflicts in Git, at ${path}`;
  }

  /** A commit's age as the Commits tab shows it, such as `5 min`, `3 h` or `12 d`; `null` past 30 days, which shows the date instead. */
  public static formatPullRequestCommitAge(milliseconds: number): string | null {
    const minutes: number = Math.max(1, Math.floor(milliseconds / 60_000));
    if (minutes < 60)
      return `${minutes} min`;
    const hours: number = Math.floor(minutes / 60);
    if (hours < 24)
      return `${hours} h`;
    const days: number = Math.floor(hours / 24);
    return days <= 30 ? `${days} d` : null;
  }
}
