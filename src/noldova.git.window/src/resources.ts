/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ConflictKind, DiffScopeKind, FileState, OperationKind } from "@noldova/git.protocol";

import { GitFileGroupKind } from "./app/enums/git-file-group-kind.ts";

export class Resources {
  public static readonly maximumPathLength: number = 4_096;
  public static readonly absolutePathPattern: RegExp = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/u;
  public static readonly folderProvided: string = "This window already has a Git folder provider; unregister it before providing another.";
  public static readonly blankFolder: string = "the folder is blank";
  public static readonly relativeFolder: string = "the folder isn't an absolute path";

  public static readonly viewName: string = "git.view";
  public static readonly viewTitle: string = "Git";
  public static readonly viewIcon: string = "account_tree";
  public static readonly getGitAddress: string = "https://git-scm.com/downloads";
  public static readonly slash: string = "/";
  public static readonly dot: string = ".";
  public static readonly ellipsis: string = "…";
  public static readonly folderTailLength: number = 12;
  public static readonly shownFilesMaximum: number = 3;
  public static readonly shortHeadLength: number = 7;

  public static readonly branchIconPath: string = "M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z";
  public static readonly menuClosedIcon: string = "expand_more";
  public static readonly menuOpenIcon: string = "expand_less";
  public static readonly pushIcon: string = "arrow_upward";
  public static readonly pullIcon: string = "arrow_downward";
  public static readonly publishIcon: string = "cloud_upload";
  public static readonly stageIcon: string = "add";
  public static readonly unstageIcon: string = "remove";
  public static readonly commitIcon: string = "check";
  public static readonly expandIcon: string = "expand_more";
  public static readonly collapseIcon: string = "expand_less";
  public static readonly wrapIcon: string = "wrap_text";
  public static readonly mergeIcon: string = "merge";
  public static readonly failureIcon: string = "error";
  public static readonly plainRemoteIcon: string = "dns";
  public static readonly noFolderIcon: string = "folder_off";
  public static readonly folderUnreadableIcon: string = "lock";
  public static readonly gitMissingIcon: string = "error";
  public static readonly gitTooOldIcon: string = "warning";
  public static readonly watchFailedIcon: string = "sync_problem";
  public static readonly openLinkIcon: string = "open_in_new";
  public static readonly createBranchIcon: string = "add";
  public static readonly currentBranchIcon: string = "check";

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
  public static readonly wrapLinesLabel: string = "Wrap lines";
  public static readonly unwrapLinesLabel: string = "Don't wrap lines";
  public static readonly messageLabel: string = "Commit message";
  public static readonly messagePlaceholder: string = "Message";
  public static readonly commitLabel: string = "Commit";
  public static readonly commitMergeLabel: string = "Commit the merge";
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

  public static formatFolderTooLong(maximum: number): string {
    return `the folder has more than ${maximum} characters`;
  }

  public static formatChangedRefused(reason: string): string {
    return `The Git view ignored a change event it could not read: ${reason}`;
  }

  public static formatPullHooksFailed(reason: string): string {
    return `The Git view couldn't read the hooks a pull runs: ${reason}`;
  }

  public static formatPullHooks(hooks: readonly string[] | null): string {
    if (hooks === null)
      return Resources.pullHooksUnread;
    return `${Resources.pullDescription}. Hooks that will run: ${hooks.length === 0 ? "None" : hooks.join(", ")}`;
  }

  public static formatWatchFailed(reason: string): string {
    return `Changes made outside the Git view aren't followed, since the folder couldn't be watched: ${reason}`;
  }

  public static formatUnwatchFailed(folder: string, reason: string): string {
    return `The Git view couldn't stop watching ${folder}: ${reason}`;
  }

  public static formatFolderFailed(reason: string): string {
    return `The Git view shows no folder, since the app's folder could not be read: ${reason}`;
  }

  public static formatHostRowFailed(reason: string): string {
    return `The Git view shows the plain remote line, since a host row's claim failed: ${reason}`;
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

  public static formatConflictHint(files: number): string {
    return `Stage the ${files} conflicted ${files === 1 ? "file" : "files"} to commit the merge.`;
  }

  public static formatOperation(operation: string, from: string | null): string {
    return from === null ? `${operation} into this branch` : `${operation} ${from} into this branch`;
  }

  public static formatConflictText(files: number): string {
    return files === 0
      ? "Every conflict is resolved. Commit to finish."
      : `${files} ${files === 1 ? "file has" : "files have"} conflicts. Resolve them in your editor, or ask a teammate, then stage them.`;
  }

  public static formatSwitchBranch(name: string): string {
    return `${Resources.switchBranchLabel}, ${name}`;
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
    return version === null ? "Your Git is too old" : `Git ${version} is too old`;
  }

  public static formatMoreFiles(count: number): string {
    return `and ${count} more`;
  }

  public static formatStage(path: string): string {
    return `${Resources.stageLabel} ${path}`;
  }

  public static formatUnstage(path: string): string {
    return `${Resources.unstageLabel} ${path}`;
  }

  public static formatRowKey(group: GitFileGroupKind, path: string): string {
    return `${group}:${path}`;
  }

  public static formatDiffKey(fingerprint: string, scope: DiffScopeKind): string {
    return `${fingerprint}:${scope}`;
  }

  public static formatHunk(oldStart: number, oldCount: number, newStart: number, newCount: number, header: string): string {
    const range = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
    return header.length === 0 ? range : `${range} ${header}`;
  }
}
