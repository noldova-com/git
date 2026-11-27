/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Injector, InputSignal, OutputEmitterRef, Signal, Type, WritableSignal, ɵɵComponentDeclaration, ɵɵFactoryDeclaration } from "@angular/core";
import { Exception, type ExceptionOptions } from "@noldova/context.exceptions";
import type { IWindowPart, IWindowPartContext } from "@noldova/desktop.window";
import type { HostChanges, HostPullRequestFiles, HostReference } from "@noldova/git.hosting.protocol";
import type { DiffScope, GitRemote } from "@noldova/git.protocol";
import type { ILinkReferenceSource, LinkOpenEvent } from "@noldova/ui.components.angular";

/**
 * The base of the Git window part's own exceptions; catch it to catch them all.
 * It is abstract: providing a second folder provider throws {@link GitFolderProvidedException}.
 * @example
 * ```ts
 * import { GitWindowException } from "@noldova/git.window";
 *
 * export function isGitWindowFailure(error: unknown): boolean {
 *   return error instanceof GitWindowException;
 * }
 * ```
 */
export declare abstract class GitWindowException extends Exception {
  /**
   * The exception's name, `GitWindowException` unless a subclass names itself.
   */
  public override readonly name: string;

  /**
   * Creates the exception; only the window part's own exceptions call it.
   * @param message The message, from the window part's resources.
   * @param options The cause, when there is one.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * Thrown when an app provides the Git view's folder while another provider is still registered.
 */
export declare class GitFolderProvidedException extends GitWindowException {
  /**
   * The exception's name, `GitFolderProvidedException`.
   */
  public override readonly name: string;

  /**
   * Creates the exception, with a message that says to unregister the first provider.
   */
  public constructor();
}

/**
 * A host module's row in the Git view, shown under the branch for a remote the module claims, such as GitHub's pull request and its checks.
 *
 * @remarks
 * The view renders the component with the inputs `folder` (the repository's absolute folder), `branch` (the current branch, or `null` on a detached
 * HEAD), `head` (the commit HEAD names, or `null` before the first commit) and `remote` (the {@link GitRemote} it claimed). Its injector gives
 * `WindowPartTokens.context` as the providing module's context, not the Git view's, so the row reads and asks under its own module.
 */
export interface IGitHostRow {
  /**
   * Whether the row shows for this remote; the first registered row that claims a remote wins.
   * @param remote The repository's remote; its host and path are untrusted.
   * @returns `true` when the row shows for the remote.
   */
  claims(remote: GitRemote): boolean;

  /**
   * The standalone component the view renders in the row's place.
   */
  readonly component: Type<unknown>;
}

/**
 * What a host module gives the Git view so that commit authors show its pictures of them.
 */
export interface IGitAvatars {
  /**
   * Reads an author's picture in the repository at a folder.
   * The view reads it inside a computed signal, so a host that answers from signals shows the picture once it arrives.
   * @param folder The repository's folder.
   * @param email The author's email as the commit names it.
   * @param commitId The full id of a commit of theirs, for a host that finds people by commit.
   * @returns The picture as a base64 `data:` address, `null` when the host has none for them, or `undefined` while it is still reading.
   */
  avatarOf(folder: string, email: string, commitId: string): string | null | undefined;
}

/**
 * What a host module gives the Git view so that a new commit's message starts with its prefix for the branch, such as a work item's id.
 */
export interface IGitCommitPrefixes {
  /**
   * The prefix for a new commit's message on a branch of the repository at a folder.
   * The view reads it inside a computed signal, so a host that answers from signals fills the message once its answer arrives.
   * @param folder The repository's folder.
   * @param branch The current branch's short name; the view asks for none on a detached HEAD.
   * @returns The prefix, or `null` when the host has none for the branch.
   */
  prefixFor(folder: string, branch: string): string | null;
}

/**
 * What a host module gives a pull request page's Commits, Files and Conflicts tabs and its comment threads, which the Git module draws the same way for every
 * host.
 * @example
 * ```ts
 * import type { IGitPullRequestHost } from "@noldova/git.window";
 *
 * export const host: IGitPullRequestHost = {
 *   name: "Example", readCommitsMethod: "example.readPullRequestCommits", readChangesMethod: "example.readPullRequestChanges",
 *   readConflictsMethod: "example.readPullRequestConflicts", readThreadsMethod: "example.readPullRequestThreads", replyToThreadMethod: null,
 *   changeThreadMethod: null, localFolderAsync: async () => null, commitPageOf: (url, commitId) => `${url}/commits/${commitId}`, personAvatarOf: () => null
 * };
 * ```
 */
export interface IGitPullRequestHost {
  /**
   * The host's name as the tabs show it, such as `Azure DevOps`.
   */
  readonly name: string;

  /**
   * The method that answers a pull request's commits as `HostPullRequestCommits`, asked with its `HostReference`.
   */
  readonly readCommitsMethod: string;

  /**
   * The method that answers the files a pull request's latest push changes as `HostPullRequestFiles`, asked with its `HostReference`.
   */
  readonly readChangesMethod: string;

  /**
   * The method that answers the paths that keep a pull request from merging as `HostPullRequestConflicts`, asked with its `HostReference`.
   */
  readonly readConflictsMethod: string;

  /**
   * The method that answers a pull request's comment threads as `HostPullRequestThreads`, asked with its `HostReference`.
   */
  readonly readThreadsMethod: string;

  /**
   * The method that replies to a thread, asked with `{ reference, thread, parent, body }`: the pull request's `HostReference`, the thread's id, its first
   * comment's id and the reply's Markdown; it answers the reply as a `HostComment`. `null` for a host that can't reply, whose threads show no Reply.
   */
  readonly replyToThreadMethod: string | null;

  /**
   * The method that resolves or reactivates a thread, asked with `{ reference, thread, state }`, the new `ThreadStatus`. `null` for a host that keeps no
   * thread state, whose threads show no Resolve or Reactivate.
   */
  readonly changeThreadMethod: string | null;

  /**
   * The open repository's folder when it is the pull request's own repository.
   * @param pullRequestUrl The pull request's page on the host.
   * @returns The folder, or `null` for another repository, none open, or one the host can't tell.
   */
  localFolderAsync(pullRequestUrl: string): Promise<string | null>;

  /**
   * A commit's page on the host, which the Commits tab opens when the open repository can't show the commit.
   * @param pullRequestUrl The pull request's page on the host.
   * @param commitId The commit's full id.
   * @returns The commit's page.
   */
  commitPageOf(pullRequestUrl: string, commitId: string): string;

  /**
   * A comment author's picture, which the threads ask once the author first comes into view.
   * The threads read it inside a computed signal, so a host that answers from signals shows the picture once it arrives.
   * @param reference The pull request the comment is on, such as for Azure DevOps's organization; a host that finds people by login alone may ignore it.
   * @param login The author's sign-in name as the comment names it.
   * @returns The picture as a base64 `data:` address, `null` when the host has none for them, or `undefined` while it is still reading.
   */
  personAvatarOf(reference: HostReference, login: string): string | null | undefined;
}

/**
 * What a host module gives the Git view so that links to its items in a commit's message show as reference chips.
 */
export interface IGitLinkReferences {
  /**
   * The links this host knows in the repository at a folder.
   * The view reads it inside a computed signal, so a source whose answer depends on signals keeps the message current.
   * @param folder The repository's folder.
   * @returns The source, or `null` when the host knows no links there.
   */
  referencesFor(folder: string): ILinkReferenceSource | null;

  /**
   * Opens a link of the host's own, such as a reference card's action, in the repository at a folder; left out, the host opens none.
   * @param folder The repository's folder.
   * @param url The link the person opened.
   * @param injector The window's injector, from which the host can open a kit dialog, such as with `DialogService`.
   * @returns True when the host opened it; false leaves it to the window, which opens it in a browser.
   */
  opens?(folder: string, url: string, injector: Injector): boolean;
}

/**
 * What a host module gives the repository panel so that it shows rows for the host's pages under Changes and History.
 */
export interface IGitRepositoryLinks {
  /**
   * The rows for a repository whose remote this is.
   * The panel reads it inside a computed signal, so a host added later shows its rows.
   * @param remote The repository's remote.
   * @returns The rows, in order; none for a remote the host doesn't claim.
   */
  linksFor(remote: GitRemote): readonly GitRepositoryLink[];
}

/**
 * What a module that runs agents gives the repository panel so that it lists the agents working in a repository.
 */
export interface IGitAgents {
  /**
   * The runs working in the repository or its worktrees, newest first, or null before the provider has any answer.
   * The panel reads it inside a computed signal, so the provider answers the same signal for a folder each time and updates it.
   * @param folder The repository's folder.
   */
  listFor(folder: string): Signal<readonly GitAgentRow[] | null>;

  /**
   * Shows the run, such as in the provider's own view; the panel calls it when the person clicks the run's row.
   * @param folder The repository's folder.
   * @param row The run the person clicked.
   */
  open(folder: string, row: GitAgentRow): void;
}

/**
 * Where an agent's run in a repository stands, which its row's icon shows.
 */
export declare enum GitAgentState {
  /** The agent is working. */
  Working = "Working",
  /** The agent waits for the person, such as for an answer or an approval. */
  WaitingForYou = "WaitingForYou",
  /** The run ended with its work done. */
  Done = "Done",
  /** The run ended with a failure. */
  Failed = "Failed"
}

/**
 * One agent's run as the repository panel lists it: its task's name, where it stands and the worktree it works in.
 */
export declare class GitAgentRow {
  /** The provider's own key for the run, such as its id; the panel never reads it, and gives it back to the provider's open(). */
  public readonly key: string;
  /** The run's task, as a short name such as "Blame gutter". */
  public readonly name: string;
  public readonly state: GitAgentState;
  /** The folder of the worktree the run works in; the section's header counts the distinct ones. */
  public readonly worktree: string;

  public constructor(key: string, name: string, state: GitAgentState, worktree: string);
}

/**
 * The agent runs modules give the repository panel; its Agents section, between Branches and Pull requests, lists every provider's runs
 * together, and shows only while at least one provider is given.
 */
export declare class GitAgents {
  /** Every provider given and not yet removed. */
  public static readonly all: Signal<readonly IGitAgents[]>;

  /**
   * Gives the panel a module's agent runs, until the returned function removes them.
   * @example
   * const remove = GitAgents.provide({ listFor: folder => runs.of(folder), open: (folder, row) => runs.show(row.key) });
   * @param agents The module's runs.
   * @returns The function that removes them.
   */
  public static provide(agents: IGitAgents): () => void;
}

/**
 * What a host module gives the repository panel so that it lists a repository's open pull requests on that host.
 */
export interface IGitPullRequests {
  /**
   * Whether a remote is on this host; the first host that claims the current branch's remote lists its pull requests.
   * @param remote The current branch's remote.
   * @returns True when this host lists its pull requests.
   */
  claims(remote: GitRemote): boolean;

  /**
   * The host's name, which the section's header shows, such as "GitHub".
   */
  readonly hostName: string;

  /**
   * The settings page whose sign-in a signed-out section opens.
   */
  readonly signInPage: string;

  /**
   * The repository's open pull requests on the remote, newest first.
   * The panel reads it inside a computed signal, so the host answers the same signal for a folder and remote each time and updates it.
   * @param folder The repository's folder.
   * @param remote The current branch's remote.
   * @returns The list, or `null` before the host has any answer.
   */
  listFor(folder: string, remote: GitRemote): Signal<GitPullRequestList | null>;

  /**
   * Reads them again: the panel asks when the section first shows a folder or remote, when the window takes the focus, and on Try again.
   * @param folder The repository's folder.
   * @param remote The current branch's remote.
   */
  refresh(folder: string, remote: GitRemote): void;

  /**
   * A branch's newest pull request in any state, with its checks, or its head commit's checks when it has none; the workspace page reads it
   * inside a computed signal, so the host answers the same signal for a folder, remote, branch and head commit each time and updates it, a newer
   * read overtaking an older one. Left out, the workspace page finds the branch's pull request among {@link listFor}'s open ones.
   * @param folder The repository's folder.
   * @param remote The branch's remote.
   * @param branch The branch's name.
   * @param headCommit The branch's head commit, whose checks show when it has no pull request, or `null` when it is unknown.
   * @returns The branch's pull request, or `null` before the host has any answer.
   */
  branchFor?(folder: string, remote: GitRemote, branch: string, headCommit: string | null): Signal<GitBranchPullRequest | null>;

  /**
   * Reads a branch's pull request again: the workspace page asks when the branch's row first shows and when the window takes the focus.
   * @param folder The repository's folder.
   * @param remote The branch's remote.
   * @param branch The branch's name.
   * @param headCommit The branch's head commit, or `null` when it is unknown.
   */
  refreshBranch?(folder: string, remote: GitRemote, branch: string, headCommit: string | null): void;

  /**
   * The repository's open pull requests with their head and base branches, for finding stacks only, or null before the host has any answer or
   * after a read that failed; for a host with `branchFor`, whose `listFor` the workspace page doesn't read. Its rows carry no approvals or checks,
   * so nothing shows them. The workspace page reads it inside a computed signal, so the host answers the same signal for a remote each time, reads
   * it when first asked, and forgets a failed read. Without this member, the page finds stacks only for a host without `branchFor`.
   * @param folder The repository's folder.
   * @param remote The repository's remote.
   * @returns The open pull requests' heads and bases, or `null` before the host has any answer.
   */
  stackListFor?(folder: string, remote: GitRemote): Signal<GitPullRequestList | null>;

  /**
   * The pull request that brought a commit in, in any state, with its checks; the commit's detail shows it as a card under the files. The detail
   * reads it inside a computed signal, so the host answers the same signal for a folder, remote and commit each time, reads it when first asked,
   * and updates it. Left out, the commit's detail shows no pull request.
   * @param folder The repository's folder.
   * @param remote The current branch's remote.
   * @param commitId The commit's full id.
   * @returns The pull request, {@link GitBranchPullRequest.none} when no pull request brought the commit in, or `null` before the host has any answer.
   */
  commitFor?(folder: string, remote: GitRemote, commitId: string): Signal<GitBranchPullRequest | null>;

  /**
   * The review comments on a commit; the commit's detail shows "3 review comments on this commit" above 0, which opens their page in the browser.
   * The detail reads it inside a computed signal, so the host answers the same signal for a remote and commit each time, reads it when first asked,
   * and forgets a failed read so the next time the detail shows the commit reads it again. Left out, the commit's detail shows no comments row.
   * @param folder The repository's folder.
   * @param remote The current branch's remote.
   * @param commitId The commit's full id.
   * @returns The comments, or `null` before the host has any answer or after a read that failed.
   */
  commentsFor?(folder: string, remote: GitRemote, commitId: string): Signal<GitCommitComments | null>;

  /**
   * The open pull requests on the remote's repository that ask the signed-in person for a review, their own or, where the host knows it, a team's;
   * the workspace page's Needs you lists them across its repositories. Keyed by the remote, so the folders of one repository share one read; the
   * page reads it inside a computed signal, so the host answers the same signal for a remote each time and updates it. A row carries no counts or
   * head branch. Left out, the host shows no review requests.
   * @param remote A listed repository's remote on this host.
   * @returns The review requests, newest first, `hasMore` when the host's answer was cut, or `null` before the host has any answer.
   */
  reviewsFor?(remote: GitRemote): Signal<GitPullRequestList | null>;

  /**
   * Reads the review requests again: the workspace page asks for each listed repository's remote when it lists them and when the window takes the
   * focus. A host may answer from a read it holds, such as one search of the account a minute.
   * @param remote A listed repository's remote on this host.
   */
  refreshReviews?(remote: GitRemote): void;

  /**
   * The host's page that opens a new pull request, which the history's branch drop opens in the browser. Left out, or answering null, the drop holds
   * its pull request choice.
   * @param remote The current branch's remote on this host.
   * @param source The dropped branch, as the remote names it.
   * @param target The branch it was dropped on, as the remote names it.
   * @returns The page's address, or `null` when the host has none for them.
   */
  newPullRequestUrl?(remote: GitRemote, source: string, target: string): string | null;

  /**
   * Opens a pull request in the host's own page; left out, the panel opens its page in the browser.
   * @param folder The repository's folder.
   * @param row The pull request the person clicked.
   * @returns True when the host opened it; false leaves it to the panel, which opens its page in the browser.
   */
  open?(folder: string, row: GitPullRequestRow): boolean;
}

/**
 * Where a host's read of a repository's open pull requests stands.
 */
export declare enum GitPullRequestsState {
  /** The host is reading them, and has none to show yet. */
  Reading = "Reading",
  /** The host read them. */
  Ready = "Ready",
  /** Nobody is signed in to the host, so it can't read them; the section offers its sign-in. */
  SignedOut = "SignedOut",
  /** The host's read failed; the section shows why, with Try again. */
  Failed = "Failed"
}

/**
 * One open pull request as the repository panel lists it: a status dot, its label and title, and a note.
 * The dot shows failing checks first, then running ones, then passed ones; the note shows the failing checks, else that checks run, else the
 * reviews, else that it is a draft.
 */
export declare class GitPullRequestRow {
  /** The host's own key for it, such as its id; the window never reads it, and gives it back to the host's open(). */
  public readonly key: string;
  /** The host's label for it, such as "#214" or "!752". */
  public readonly label: string;
  public readonly title: string;
  /** Its page on the host, which a click opens unless the host opens it itself. */
  public readonly url: string;
  public readonly isDraft: boolean;
  /** Its approving reviews. */
  public readonly approvals: number;
  /** Its checks that passed. */
  public readonly passed: number;
  /** Its checks that failed. */
  public readonly failing: number;
  /** Its checks that still run or wait. */
  public readonly pending: number;
  /** The branch it merges from, without refs/heads/, such as "feature/sign-in"; the workspace page shows the pull request of a repository's current branch. */
  public readonly headBranch: string;
  /**
   * The branch it merges into, without refs/heads/, such as "main", or `null` when the host didn't say; the workspace page shows a pull request
   * whose base is another open pull request's head as stacked on it.
   */
  public readonly baseBranch: string | null;

  /** @param baseBranch The branch it merges into, or `null`, the default, when the host doesn't say. */
  public constructor(key: string, label: string, title: string, url: string, isDraft: boolean, approvals: number, passed: number, failing: number, pending: number,
    headBranch: string, baseBranch?: string | null);
}

/**
 * The review comments on a commit as its detail shows them: how many, whether the host's answer was cut, and the host's page that shows them.
 */
export declare class GitCommitComments {
  /** The comments the host counted; the detail shows the row only above 0. */
  public readonly count: number;
  /** Whether a page of the host's answer was full, so there may be more than the count; the row then shows "100+" or "3+". */
  public readonly isCapped: boolean;
  /** The host's page that shows them, which a click opens in the browser; null when there are none. */
  public readonly url: string | null;

  public constructor(count: number, isCapped: boolean, url: string | null);
}

/**
 * A host's open pull requests in a repository, with where its read stands; the section lists the first 20, and says when there are more.
 */
export declare class GitPullRequestList {
  public readonly state: GitPullRequestsState;
  /** The pull requests, newest first. */
  public readonly rows: readonly GitPullRequestRow[];
  /** Why the read failed, in the host's words, or `null`. */
  public readonly failure: string | null;
  /** Whether the host's answer was cut, so there may be more past the rows; review requests set it when the account's search was cut. */
  public readonly hasMore: boolean;
  /**
   * When the host's rate limit for the account resets, as milliseconds since the epoch, on a read that failed because that limit is used up, or `null`.
   * The section then writes the time by the person's time and date format settings, in place of the time in `failure`.
   */
  public readonly limitedUntil: number | null;

  /**
   * A read that runs.
   * @param rows The rows the last read gave, which the section keeps showing until this one ends; none by default.
   */
  public static reading(rows?: readonly GitPullRequestRow[]): GitPullRequestList;

  /**
   * A read that ended.
   * @param rows The pull requests, newest first.
   * @param hasMore Whether the host's answer was cut; false by default.
   */
  public static ready(rows: readonly GitPullRequestRow[], hasMore?: boolean): GitPullRequestList;

  /** Nobody is signed in to the host. */
  public static signedOut(): GitPullRequestList;

  /**
   * A read that failed.
   * @param failure Why, in the host's words, which the section shows.
   * @param rows The rows the last read gave, which review requests keep showing after a failed read; none by default.
   */
  public static failed(failure: string, rows?: readonly GitPullRequestRow[]): GitPullRequestList;

  /**
   * A read that failed with an error: a runtime failure's message, or the fallback for any other error, and, when the runtime part's failure says
   * the host's rate limit is used up, when it resets, from the `details` field `HostingNames.rateLimitedUntilDetail` of `@noldova/git.hosting.protocol`.
   * @param error What the read threw.
   * @param fallback What the section shows for an error that isn't a runtime failure.
   * @param rows The rows the last read gave, which review requests keep showing after a failed read; none by default.
   */
  public static failedBy(error: unknown, fallback: string, rows?: readonly GitPullRequestRow[]): GitPullRequestList;
}

/** Where a branch's pull request stands on its host. */
export declare enum GitPullRequestState {
  Open = "Open",
  Draft = "Draft",
  Merged = "Merged",
  /** Closed without merging, or abandoned. */
  Closed = "Closed"
}

/**
 * A branch's newest pull request on its host, in any state, with its checks; or, when the branch has none, the checks of its head commit.
 * The workspace page shows it in a repository's Pull request and Checks cells: "#214 open", "#1046 draft", "#22 merged", "#9 closed", or
 * "Review #533" for an open one that waits for its reviews, and the worst of the checks.
 */
export declare class GitBranchPullRequest {
  /** Where the host's read stands. */
  public readonly state: GitPullRequestsState;
  /** The pull request, which a click opens through the host's `open`, or `null` when the branch has none or the read has no answer. */
  public readonly pullRequest: GitPullRequestRow | null;
  /** Where the pull request stands, or `null` without one. */
  public readonly pullRequestState: GitPullRequestState | null;
  /** Whether the open pull request waits for its reviews: none approves it or requests changes. */
  public readonly isWaitingForReview: boolean;
  /** The checks that passed: the pull request's, or the head commit's without one. */
  public readonly passed: number;
  /** The checks that failed. */
  public readonly failing: number;
  /** The checks that still run or wait. */
  public readonly pending: number;
  /** Why the read failed, in the host's words, or `null`. */
  public readonly failure: string | null;
  /**
   * The host's own word for where the pull request stands, as its site shows it, such as Azure DevOps' "Active", "Completed" or "Abandoned", which the
   * commit's pull request card and the workspace page show; `null` shows Git's word for `pullRequestState`: Open, Draft, Merged or Closed.
   */
  public readonly stateLabel: string | null;

  /**
   * A read that runs, keeping the last read's state word.
   * @param last What the last read gave, which the page keeps showing until this one ends; none by default.
   */
  public static reading(last?: GitBranchPullRequest | null): GitBranchPullRequest;

  /**
   * The branch's pull request, with its checks counted on the row.
   * @param pullRequest The pull request, whose `passed`, `failing` and `pending` count its checks.
   * @param state Where it stands.
   * @param isWaitingForReview Whether none of its reviews approves it or requests changes yet.
   * @param stateLabel The host's own word for where it stands, such as "Completed", or `null`, the default, for Git's word for `state`.
   * @example
   * ```ts
   * import { GitBranchPullRequest, GitPullRequestRow, GitPullRequestState } from "@noldova/git.window";
   *
   * const shown = GitBranchPullRequest.of(new GitPullRequestRow("214", "#214", "Draw lanes", "https://github.com/example-owner/site/pull/214", false, 0, 3, 0,
   *   1, "feature/lanes"), GitPullRequestState.Open, true);
   * ```
   */
  public static of(pullRequest: GitPullRequestRow, state: GitPullRequestState, isWaitingForReview: boolean, stateLabel?: string | null): GitBranchPullRequest;

  /**
   * No pull request for the branch.
   * @param passed The head commit's checks that passed.
   * @param failing Those that failed.
   * @param pending Those that still run or wait.
   */
  public static none(passed: number, failing: number, pending: number): GitBranchPullRequest;

  /** Nobody is signed in to the host. */
  public static signedOut(): GitBranchPullRequest;

  /**
   * A read that failed.
   * @param failure Why, in the host's words, or `null` when it gave none.
   */
  public static failed(failure: string | null): GitBranchPullRequest;
}

/**
 * A host row as {@link GitHostRows.provide} added it, with the context of the window part that provided it.
 */
export interface IProvidedGitHostRow {
  /**
   * The providing window part's context, which the view gives the row's component as `WindowPartTokens.context`.
   */
  readonly context: IWindowPartContext;

  /**
   * The row.
   */
  readonly row: IGitHostRow;
}

/**
 * A feature a host can have, as the "What each host can do" table on Accounts and hosts lists it.
 */
export declare enum GitHostFeature {
  /** Opening and reading pull requests. */
  PullRequests = "PullRequests",
  /** Reviewers' votes and branch policies on a pull request. */
  VotesAndPolicies = "VotesAndPolicies",
  /** Builds or checks on commits. */
  BuildsOnCommits = "BuildsOnCommits",
  /** Work items or issues. */
  WorkItems = "WorkItems",
  /** Creating a branch from a work item. */
  BranchFromItem = "BranchFromItem",
  /** Completing a pull request by itself once its policies pass. */
  AutoComplete = "AutoComplete"
}

/**
 * The state of a {@link GitHostCard}, which picks what it ends with.
 */
export declare enum GitHostCardState {
  /** Signed in: a chip with the success dot, and a button that opens the host's account. */
  SignedIn = "SignedIn",
  /** A sign-in waits on the person, such as for a code or the browser: a plain chip, and the button that opens it. */
  Waiting = "Waiting",
  /** Signed out: a button that opens the host's sign-in. */
  SignedOut = "SignedOut",
  /** The sign-in couldn't be read or failed: a button that opens the host's sign-in. */
  Failed = "Failed"
}

/**
 * One account or sign-in a host shows on Accounts and hosts.
 * @example
 * ```ts
 * import { GitHostCard, GitHostCardState } from "@noldova/git.window";
 *
 * export const signedIn: GitHostCard = new GitHostCard("GitHub · kim", "Device sign-in", GitHostCardState.SignedIn, "Signed in");
 * ```
 */
export declare class GitHostCard {
  /** The card's title, such as the host and the account's name. */
  public readonly title: string;

  /** The line under the title, such as how the account signed in and what it reaches. */
  public readonly detail: string;

  /** The card's state. */
  public readonly state: GitHostCardState;

  /** The chip's text, or the button's while it asks to sign in. */
  public readonly label: string;

  /**
   * Creates a card.
   * @param title The card's title.
   * @param detail The line under the title.
   * @param state The card's state.
   * @param label The chip's text, or the button's while it asks to sign in.
   */
  public constructor(title: string, detail: string, state: GitHostCardState, label: string);

  /** Whether the card ends with a button that opens the host's sign-in rather than a chip: while it is signed out or its sign-in failed. */
  public get asksToSignIn(): boolean;
}

/**
 * A host's accounts as a host module gives them to Accounts and hosts with {@link GitHostAccounts.provide}.
 */
export interface IGitHostAccount {
  /** The host's id, `<module id>.<name>`, unique among the hosts; the page's Settings search row for the host is `git.account.<id>`. */
  readonly id: string;

  /** The host's name, such as Azure DevOps, which titles its menu item under Add an account and its dialog. */
  readonly host: string;

  /** The host's short name, such as Azure, which titles its column in What each host can do. */
  readonly column: string;

  /** The two letters on the host's 2rem tile, such as GH. */
  readonly mark: string;

  /** The tile's background, the host's brand colour as a CSS colour; its text is the kit's button text colour. */
  readonly markColor: string;

  /** The host's cards, one per account or sign-in, which the page follows as they change. */
  readonly cards: Signal<readonly GitHostCard[]>;

  /** The component the host's dialog shows, which draws its own sign-in, account and sign-out, with the providing part's context as `WindowPartTokens.context`. */
  readonly signIn: Type<unknown>;

  /** The features the host has, each once; the table shows the others as missing. */
  readonly features: readonly GitHostFeature[];
}

/**
 * A host's accounts as {@link GitHostAccounts.provide} added them, with the context of the window part that provided them.
 */
export interface IProvidedGitHostAccount {
  /** The providing window part's context, which the dialog gives the host's component as `WindowPartTokens.context`. */
  readonly context: IWindowPartContext;

  /** The host's accounts. */
  readonly account: IGitHostAccount;
}

/**
 * The folder the Git view shows, which the app provides.
 */
export declare class GitFolder {
  /**
   * The provided folder, or `null` when there is no provider, it gives none, its value is refused, or reading it throws; a refused value or a throw
   * is logged through the provider's context, and the view shows a throw's message as its failure.
   */
  public static readonly folder: Signal<string | null>;

  /**
   * The message of the error the provided folder threw when read, which the view shows as its failure, or `null` when reading it didn't throw or
   * there is no provider.
   * @example
   * ```ts
   * import { computed, type Signal } from "@angular/core";
   * import { GitFolder } from "@noldova/git.window";
   *
   * export const folderUnreadable: Signal<boolean> = computed(() => GitFolder.failure() !== null);
   * ```
   */
  public static readonly failure: Signal<string | null>;

  /**
   * Provides the folder the Git view shows.
   * @param context The window part's context, which logs a folder the view refuses.
   * @param folder The folder, an absolute path of at most 4096 characters, or `null` for none.
   * @returns A function that unregisters the provider.
   * @throws {GitFolderProvidedException} When another provider is still registered.
   * @example
   * ```ts
   * import { signal } from "@angular/core";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { GitFolder } from "@noldova/git.window";
   *
   * export function showFolder(context: IWindowPartContext): () => void {
   *   return GitFolder.provide(context, signal("/home/a/repo"));
   * }
   * ```
   */
  public static provide(context: IWindowPartContext, folder: Signal<string | null>): () => void;

  /**
   * Points the Git views at the repository a document shows, ahead of the provided folder, until the returned function is called or another
   * document is shown; a history document's own repository, while its tab is the window's active document, comes ahead of it. It has no effect while no
   * folder is provided.
   * @param folder The repository's folder, an absolute path of at most 4096 characters.
   * @returns A function that stops pointing at it, unless another document was shown since.
   * @example
   * ```ts
   * import { GitFolder } from "@noldova/git.window";
   *
   * export function showRepository(folder: string): () => void {
   *   return GitFolder.show(folder);
   * }
   * ```
   */
  public static show(folder: string): () => void;
}

/**
 * How an app wants the Git view laid out.
 * @example
 * ```ts
 * import { GitViewOptions } from "@noldova/git.window";
 *
 * export function hideBranchCard(): void {
 *   GitViewOptions.showsBranch.set(false);
 * }
 * ```
 */
export declare class GitViewOptions {
  /**
   * Whether the view starts with the branch card, `true` by default; an app that shows branches, Pull and Push elsewhere turns it off, and the view
   * titles its changes with the branch instead.
   */
  public static readonly showsBranch: WritableSignal<boolean>;
  /**
   * Whether the module offers its AI features, `false` by default: Suggest on the commit message, Explain in a commit's detail and Tidy up for
   * review on the rebase screen. An app that runs them turns it on; while it is off none of them shows, and the rows they sit in close up.
   * @example
   * ```ts
   * import { GitViewOptions } from "@noldova/git.window";
   *
   * export function offerAiFeatures(): void {
   *   GitViewOptions.showsAiFeatures.set(true);
   * }
   * ```
   */
  public static readonly showsAiFeatures: WritableSignal<boolean>;
}

/**
 * The host rows other modules add to the Git view.
 */
export declare class GitHostRows {
  /**
   * Adds a host row; rows are asked in the order they were added.
   * @param context The providing window part's context, which logs a claim that throws.
   * @param row The row.
   * @returns A function that removes the row.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { GitHostRows } from "@noldova/git.window";
   *
   * export function addRow(context: IWindowPartContext, component: import("@angular/core").Type<unknown>): () => void {
   *   return GitHostRows.provide(context, { claims: t => t.host === "github.com", component });
   * }
   * ```
   */
  public static provide(context: IWindowPartContext, row: IGitHostRow): () => void;

  /**
   * Finds the row for a remote.
   * @param remote The repository's remote.
   * @returns The first added row that claims the remote, with its providing context, the same object for as long as the row stays added, or `null`
   * when none does and the view shows the plain remote line; a row whose claim throws is logged and skipped.
   */
  public static rowFor(remote: GitRemote): IProvidedGitHostRow | null;
}

/**
 * The hosts other modules add to Accounts and hosts, the Git module's Settings page `git.accounts`.
 */
export declare class GitHostAccounts {
  /** The added hosts, in the order they were added. */
  public static readonly accounts: Signal<readonly IProvidedGitHostAccount[]>;

  /**
   * Adds a host, which the page shows after those added before it, and Settings search finds by its row.
   * @param context The providing window part's context, which the host's dialog component gets.
   * @param account The host's accounts.
   * @returns A function that removes the host.
   * @example
   * ```ts
   * import { signal, type Type } from "@angular/core";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { GitHostAccounts, GitHostFeature } from "@noldova/git.window";
   *
   * export function addHost(context: IWindowPartContext, signIn: Type<unknown>): () => void {
   *   return GitHostAccounts.provide(context, { id: "git-github.account", host: "GitHub", column: "GitHub", mark: "GH", markColor: "#24292f", cards: signal([]), signIn,
   *     features: [GitHostFeature.PullRequests] });
   * }
   * ```
   */
  public static provide(context: IWindowPartContext, account: IGitHostAccount): () => void;

  /**
   * Calls a listener with the added hosts now and after each host is added or removed.
   * @param listener The listener.
   * @returns A function that stops calling it.
   */
  public static follow(listener: (accounts: readonly IProvidedGitHostAccount[]) => void): () => void;
}

/**
 * The commit authors' pictures: each host module's first, asked in the order they were added, then the fallbacks', which the Git module's window
 * part adds for Gravatar; a host still reading holds the fallbacks back, so a picture doesn't change once shown.
 */
export declare class GitAvatars {
  /**
   * Adds a host's pictures; hosts are asked in the order they were added.
   * @param avatars The host's pictures.
   * @returns A function that removes them.
   * @example
   * ```ts
   * import { GitAvatars } from "@noldova/git.window";
   *
   * export function addPictures(pictures: ReadonlyMap<string, string>): () => void {
   *   return GitAvatars.provide({ avatarOf: (_folder, email) => pictures.get(email) ?? null });
   * }
   * ```
   */
  public static provide(avatars: IGitAvatars): () => void;

  /**
   * Adds pictures asked only once every host has none for an author, in the order they were added.
   * @param avatars The fallback's pictures.
   * @returns A function that removes them.
   * @example
   * ```ts
   * import { GitAvatars } from "@noldova/git.window";
   *
   * export function addFallback(picture: string): () => void {
   *   return GitAvatars.provideFallback({ avatarOf: () => picture });
   * }
   * ```
   */
  public static provideFallback(avatars: IGitAvatars): () => void;

  /**
   * An author's picture; read inside a computed signal, it changes once a picture arrives.
   * @param folder The repository's folder.
   * @param email The author's email as the commit names it.
   * @param commitId The full id of a commit of theirs.
   * @returns The first picture a host has, else the first a fallback has, as a base64 `data:` address; `null` while none is known.
   * @example
   * ```ts
   * import { GitAvatars } from "@noldova/git.window";
   *
   * export const picture: string | null = GitAvatars.imageOf("/home/a/repo", "kim@example.com", "0123456789abcdef0123456789abcdef01234567");
   * ```
   */
  public static imageOf(folder: string, email: string, commitId: string): string | null;
}

/**
 * The commit message prefixes host modules give the Git view's commit box.
 * The box starts an empty message with the prefix for the current branch, and when the branch changes it swaps a prefix still untouched for the
 * new branch's, or empties it; it never changes text the person typed. A message the person clears stays empty until the branch changes, a commit
 * is made or amending is turned off.
 */
export declare class GitCommitPrefixes {
  /**
   * Adds a host's prefixes; hosts are asked in the order they were added, and the first that answers other than `null` wins.
   * @param context The providing window part's context, which logs an answer that throws before the next host is asked.
   * @param prefixes The host's prefixes.
   * @returns A function that removes only this host's prefixes.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { GitCommitPrefixes } from "@noldova/git.window";
   *
   * export function addPrefixes(context: IWindowPartContext): () => void {
   *   return GitCommitPrefixes.provide(context, { prefixFor: (_folder, branch) => branch === "users/kim/7521-export-notes" ? "AB#7521 " : null });
   * }
   * ```
   */
  public static provide(context: IWindowPartContext, prefixes: IGitCommitPrefixes): () => void;

  /**
   * Finds the prefix for a branch.
   * @param folder The repository's folder.
   * @param branch The branch's short name.
   * @returns The first added host's prefix that isn't `null`, or `null` when none gives one; a host whose answer throws is logged and skipped.
   */
  public static prefixFor(folder: string, branch: string): string | null;
}

/** Counts in sentences and buttons as every Git window writes them: a word from one to nine and digits otherwise. */
export declare class GitCounts {
  /**
   * A count inside a sentence or a button.
   * @param count The count.
   * @returns A word from one to nine, such as "three", and digits otherwise, such as "12".
   * @example
   * ```ts
   * import { GitCounts } from "@noldova/git.window";
   *
   * export const label: string = `Open all ${GitCounts.format(3)}`;
   * ```
   */
  public static format(count: number): string;

  /**
   * A count that starts a sentence.
   * @param count The count.
   * @returns A capitalized word from one to nine, such as "Three", and digits otherwise, such as "12".
   * @example
   * ```ts
   * import { GitCounts } from "@noldova/git.window";
   *
   * export const line: string = `${GitCounts.formatStart(2)} repositories are behind`;
   * ```
   */
  public static formatStart(count: number): string;
}

/**
 * Keeps the focus on a control when the control that held it as the person pressed goes away, as a staged file's row or a dismissed banner does,
 * rather than letting it fall to the page: it moves to the control now at the pressed one's place in the nearest container that survives, such as the
 * next row's same button or the new state's first button; while none is there, as when a spinner stands in for the next state, it waits for one, until
 * the focus goes elsewhere or the person presses again. Host modules' window parts use it in their own settings and rows.
 */
export declare class FocusKeeper {
  /**
   * Keeps the focus within the root until the returned function stops it.
   * @param root The element whose controls it watches, usually a component's host element.
   * @returns A function that stops it.
   * @example
   * ```ts
   * import { Component, DestroyRef, ElementRef, inject } from "@angular/core";
   * import { FocusKeeper } from "@noldova/git.window";
   *
   * @Component({ selector: "nol-host-row", template: "<button type=\"button\">Sign out</button>" })
   * export class HostRowComponent {
   *   public constructor() {
   *     inject(DestroyRef).onDestroy(FocusKeeper.keep(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement));
   *   }
   * }
   * ```
   */
  public static keep(root: HTMLElement): () => void;
}

/**
 * The link sources host modules give the Git view, for the chips in a commit's message.
 */
export declare class GitLinkReferences {
  /**
   * Adds a host's link source; sources are asked in the order they were added.
   * @param references The host's source.
   * @returns A function that removes it.
   * @example
   * ```ts
   * import type { ILinkReferenceSource } from "@noldova/ui.components.angular";
   * import { GitLinkReferences } from "@noldova/git.window";
   *
   * export function addLinks(source: ILinkReferenceSource): () => void {
   *   return GitLinkReferences.provide({ referencesFor: () => source });
   * }
   * ```
   */
  public static provide(references: IGitLinkReferences): () => void;

  /**
   * Asks each host, in the order they were added, to open a link of its own in the repository at a folder.
   * @param folder The repository's folder.
   * @param url The link the person opened.
   * @param injector The window's injector, passed to each host.
   * @returns True when a host opened it.
   */
  public static opens(folder: string, url: string, injector: Injector): boolean;

  /**
   * The link source for the repository at a folder.
   * @param folder The repository's folder.
   * @returns `null` when no host knows links there, the one host's source when one does, or else a source that asks each in turn: the first that
   * knows a link draws it, and a text match that overlaps an earlier one is dropped.
   */
  public static of(folder: string): ILinkReferenceSource | null;
}

/**
 * A row a host module adds to the repository panel under Changes and History, such as one that opens the remote's work items.
 * @example
 * ```ts
 * import { GitRepositoryLink } from "@noldova/git.window";
 *
 * export const workItems: GitRepositoryLink = new GitRepositoryLink("workItems", "My work items", "checklist", () => undefined);
 * ```
 */
export declare class GitRepositoryLink {
  /** The row's key, unique among one host's rows. */
  public readonly key: string;

  /** The row's text. */
  public readonly label: string;

  /** The row's Material Symbols icon. */
  public readonly icon: string;

  /** Opens the row's page. */
  public readonly open: () => void;

  /** Whether the row's page is the window's active document, which selects the row in place of Changes or History. */
  public readonly isActive: Signal<boolean>;

  /**
   * Creates a row.
   * @param key The row's key, unique among one host's rows.
   * @param label The row's text.
   * @param icon The row's Material Symbols icon.
   * @param open Opens the row's page.
   * @param isActive Whether the row's page is the window's active document, such as from `WindowPartTokens.activeDocument` in the page; never, when left out.
   */
  public constructor(key: string, label: string, icon: string, open: () => void, isActive?: Signal<boolean>);
}

/**
 * The rows host modules give the repository panel under Changes and History.
 */
export declare class GitRepositoryLinks {
  /**
   * Adds a host's rows; hosts' rows show in the order they were added.
   * @param links The host's rows.
   * @returns A function that removes them.
   * @example
   * ```ts
   * import { GitRepositoryLink, GitRepositoryLinks } from "@noldova/git.window";
   *
   * export function addWorkItems(open: () => void): () => void {
   *   return GitRepositoryLinks.provide({ linksFor: remote => remote.host === "dev.azure.com" ? [new GitRepositoryLink("workItems", "My work items", "checklist", open)] : [] });
   * }
   * ```
   */
  public static provide(links: IGitRepositoryLinks): () => void;

  /**
   * Every host's rows for a repository whose remote this is.
   * @param remote The repository's remote.
   * @returns The rows, in the order the hosts were added.
   */
  public static of(remote: GitRemote): readonly GitRepositoryLink[];
}

/**
 * The pull request lists host modules give the repository panel, which shows a Pull requests section for the current branch's remote.
 */
export declare class GitPullRequests {
  /**
   * Adds a host's pull request list; hosts are asked in the order they were added.
   * @param context The providing window part's context, to which a claim that throws is logged.
   * @param pullRequests The host's list.
   * @returns A function that removes it.
   * @example
   * ```ts
   * import { signal } from "@angular/core";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { GitPullRequestList, GitPullRequests } from "@noldova/git.window";
   *
   * export function listPullRequests(context: IWindowPartContext): () => void {
   *   const list = signal(GitPullRequestList.reading());
   *   return GitPullRequests.provide(context, {
   *     claims: remote => remote.host === "example.com", hostName: "Example", signInPage: "example.account",
   *     listFor: () => list, refresh: () => list.set(GitPullRequestList.ready([]))
   *   });
   * }
   * ```
   */
  public static provide(context: IWindowPartContext, pullRequests: IGitPullRequests): () => void;

  /**
   * The first host, in the order they were added, that claims a remote; a host whose claim throws is logged to its part and passed over.
   * @param remote The current branch's remote.
   * @returns The host's list, or `null` when no host claims the remote.
   */
  public static of(remote: GitRemote): IGitPullRequests | null;
}

/**
 * A named, ordered list of repository folders that the workspace page shows together.
 */
export declare class GitWorkspace {
  /** The workspace's id, which its page opens with. */
  public readonly id: string;

  /** The name the person gave it. */
  public readonly name: string;

  /** Its repositories' absolute folders, in the person's order. */
  public readonly folders: readonly string[];
}

/**
 * The person's workspaces, in the order they made them, kept in the window's storage. The Git module's window part reads them when it activates;
 * its `git.openWorkspace` command opens one's page, with `{ id }`, or the repositories opened lately with `{ id: null }` or no arguments.
 * @example
 * ```ts
 * import type { IWindowPartContext } from "@noldova/desktop.window";
 * import { GitWorkspaces } from "@noldova/git.window";
 *
 * export async function openFirstWorkspaceAsync(context: IWindowPartContext): Promise<void> {
 *   await context.runCommandAsync("git.openWorkspace", { id: GitWorkspaces.list()[0]?.id ?? null });
 * }
 * ```
 */
export declare class GitWorkspaces {
  /** The workspaces, in the order they were made. */
  public static readonly list: Signal<readonly GitWorkspace[]>;

  /** Reads the workspaces kept in the window's storage again; one that no longer reads is dropped, and the others stay. */
  public static restore(): void;

  /**
   * Finds a workspace.
   * @param id The workspace's id.
   * @returns The workspace, or null when there is none with that id.
   */
  public static find(id: string): GitWorkspace | null;

  /**
   * Makes a workspace with no repositories.
   * @param name Its name.
   * @returns The new workspace.
   */
  public static create(name: string): GitWorkspace;

  /**
   * Removes a workspace; its repositories stay as they are.
   * @param id The workspace's id.
   */
  public static remove(id: string): void;

  /**
   * Renames a workspace.
   * @param id The workspace's id.
   * @param name The new name.
   */
  public static rename(id: string, name: string): void;

  /**
   * Adds a repository at the end of a workspace; one it already lists stays where it is.
   * @param id The workspace's id.
   * @param folder The repository's absolute folder.
   */
  public static addFolder(id: string, folder: string): void;

  /**
   * Takes repositories off a workspace.
   * @param id The workspace's id.
   * @param folders The repositories' absolute folders.
   */
  public static removeFolders(id: string, folders: ReadonlySet<string>): void;

  /**
   * Moves repositories one place up or down in a workspace's order, keeping their order among themselves.
   * @param id The workspace's id.
   * @param folders The repositories' absolute folders.
   * @param by -1 to move them up, 1 to move them down.
   */
  public static moveFolders(id: string, folders: ReadonlySet<string>, by: -1 | 1): void;
}

/**
 * The repositories opened lately, newest first, kept in the window's storage. The Git module's `git.openHistory` command puts the repository it
 * opens first, and the workspace page lists them as its open repositories.
 * @example
 * ```ts
 * import { computed, type Signal } from "@angular/core";
 * import { GitRecentRepositories } from "@noldova/git.window";
 *
 * export const current: Signal<string | null> = computed(() => GitRecentRepositories.recent()[0] ?? null);
 * ```
 */
export declare class GitRecentRepositories {
  /** The repositories' absolute folders, newest first, at most twenty. */
  public static readonly recent: Signal<readonly string[]>;

  /** Reads the list kept in the window's storage again, keeping only its folders. */
  public static restore(): void;

  /**
   * Puts a repository first, and drops the oldest past twenty.
   * @param folder The repository's absolute folder.
   */
  public static remember(folder: string): void;

  /**
   * Takes repositories off the list.
   * @param folders The repositories' absolute folders.
   */
  public static forget(folders: ReadonlySet<string>): void;

  /**
   * A folder's last name, which a list shows for its repository.
   * @param folder The repository's absolute folder.
   * @returns Its last name, or a fallback for a root.
   */
  public static nameOf(folder: string): string;
}

/**
 * The Dashboard, the page of the repositories opened lately, for an app's placeholder to show while no document is open, as the Dashboard tab shows it:
 * its toolbar, the repositories' table and its rows' reads, opens and writes go through Git's own window part, which must be active in the window, so a
 * placeholder another module registers shows Git's Dashboard. It takes no inputs; its selector is `nol-git-dashboard`.
 * @throws GitWindowException when Git's window part isn't active in the window as the component is made.
 * @example
 * ```ts
 * import { ContentPadding, type IWindowPartContext, PlaceholderContribution } from "@noldova/desktop.window";
 *
 * export function registerStart(context: IWindowPartContext): void {
 *   context.registerPlaceholder(new PlaceholderContribution("app.start", () => import("@noldova/git.window").then(t => t.GitDashboardComponent),
 *     ContentPadding.None));
 * }
 * ```
 */
export declare class GitDashboardComponent {
  /**
   * Angular's factory for the component, as its compiler declares it.
   */
  public static ɵfac: ɵɵFactoryDeclaration<GitDashboardComponent, never>;

  /**
   * Angular's metadata for the standalone component: its selector and no inputs, as its compiler declares it.
   */
  public static ɵcmp: ɵɵComponentDeclaration<GitDashboardComponent, "nol-git-dashboard", never, Record<string, never>, Record<string, never>, never, never, true, never>;
}

/**
 * The files a diff changes in a repository, as the commit detail shows them: a header with their count and the lines added and removed, a folder tree or
 * flat list, and each file's diff under its row once opened. It reads the diff from the repository through `git.diff`, so nothing leaves the machine; a
 * failed read shows Git's message. Inside the Git view it follows the view's file layout and offers its layout button; elsewhere it shows folders.
 * Its selector is `nol-git-diff-files`.
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { DiffScope, DiffScopeKind } from "@noldova/git.protocol";
 * import { GitDiffFilesComponent } from "@noldova/git.window";
 *
 * @Component({
 *   selector: "app-pull-request-files",
 *   imports: [GitDiffFilesComponent],
 *   template: "<nol-git-diff-files [folder]=\"folder\" [scope]=\"scope\" />"
 * })
 * export class PullRequestFilesComponent {
 *   protected readonly folder: string = "/home/a/repo";
 *   protected readonly scope: DiffScope = new DiffScope(DiffScopeKind.Range, "0123456789abcdef0123456789abcdef01234567",
 *     "9fceb02d0ae598e95dc970b74767f19372d61af8");
 * }
 * ```
 */
export declare class GitDiffFilesComponent {
  /**
   * Angular's factory for the component, as its compiler declares it.
   */
  public static ɵfac: ɵɵFactoryDeclaration<GitDiffFilesComponent, never>;

  /**
   * Angular's metadata for the standalone component: its selector and its two required signal inputs, as its compiler declares it.
   */
  public static ɵcmp: ɵɵComponentDeclaration<GitDiffFilesComponent, "nol-git-diff-files", never, {
    "folder": { "alias": "folder"; "required": true; "isSignal": true };
    "scope": { "alias": "scope"; "required": true; "isSignal": true };
  }, Record<string, never>, never, never, true, never>;

  /**
   * The repository's folder, an absolute path of at most 4096 characters.
   */
  public readonly folder: InputSignal<string>;

  /**
   * The changes to show, such as a range between two commits; another scope reads again.
   */
  public readonly scope: InputSignal<DiffScope>;
}

/**
 * A detail view beside the documents that shows what the active document of its kind chose, such as a work item or a conflict: the documents follow it
 * with their choice, it opens a view with instances with `openView`, so the focus stays in the document, or shows a plain view, such as the Commit view,
 * with `showView`, and the view draws what it shows.
 * A module keeps one for each window and view.
 * @example
 * ```ts
 * import { inject, Injector, type Signal } from "@angular/core";
 * import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
 * import { GitDetailView } from "@noldova/git.window";
 *
 * export function followNote(context: IWindowPartContext, note: Signal<string | null>): GitDetailView<string> {
 *   const detail = new GitDetailView<string>(context, "notes.detail", "selected", t => `Note ${t}`);
 *   detail.follow(note, inject(WindowPartTokens.activeDocument), inject(Injector));
 *   return detail;
 * }
 * ```
 */
export declare class GitDetailView<T> {
  /**
   * The choice of the followed document that is the window's active document: `undefined` while none is, and `null` while it has nothing chosen.
   */
  public readonly front: Signal<T | null | undefined>;

  /**
   * What the view shows: the front choice, kept while a document of another kind is in front, and `null` while the document in front has nothing
   * chosen or no followed document is open, when the view shows its empty state.
   */
  public readonly shown: Signal<T | null>;

  /**
   * Whether the view is open since a choice opened it: `false` before, and once the person closed it, which `listen` hears; a document marks its
   * choice only while it is `true`.
   */
  public readonly isOpen: Signal<boolean>;

  /**
   * Makes the detail view for one window.
   * @param context The window part's context, which opens the view and hears it close.
   * @param view The view's name, a view with instances the module registered.
   * @param instance The view's one instance, which its tab opens with.
   * @param titleOf The tab's title for a choice.
   * @param isBroughtForward Whether a followed document coming to the front brings the view forward; `false` for a view that stays where the person put
   * it, which only `showInFront` and `bringForward` open. `true` when left out.
   */
  public constructor(context: IWindowPartContext, view: string, instance: string, titleOf: (choice: T) => string, isBroughtForward?: boolean);

  /**
   * Makes the detail view for one window over a plain view, which a choice shows with `showView` under the title it was registered with, moving the
   * focus into it as `showView` does; it has no instance, so `listen` hears nothing and leaving the followed documents gives its group no front back.
   * @param context The window part's context, which shows the view.
   * @param view The view's name, a plain view the module registered.
   * @param instance `null`: a plain view has none.
   * @param titleOf `null`: the view keeps its registered title.
   * @param isBroughtForward Whether a followed document coming to the front brings the view forward. `true` when left out.
   */
  public constructor(context: IWindowPartContext, view: string, instance: null, titleOf: null, isBroughtForward?: boolean);

  /**
   * Adds a document's choice while it is open. The document coming to the front with a choice, or showing its first choice while in front, brings the
   * view to the front of its group with `openView`; a read again that keeps a choice moves nothing. While the view is open, the person leaving the
   * followed documents for another kind gives the view's group its front back with `returnView`.
   * @param choice What the document chose, or `null` for nothing.
   * @param active Whether the document is the window's active document, such as `WindowPartTokens.activeDocument`.
   * @param injector The document's injector: the document is removed once it is destroyed, and the view reacts in its context.
   * @param settled Whether the document is done reading, so that it has no choice coming without the person; while it is in front, settled and with no
   * choice, `bringForward` waits for no next choice. Left out, the document is never settled, and a wait ends only at a choice.
   */
  public follow(choice: Signal<T | null>, active: Signal<boolean>, injector: Injector, settled?: Signal<boolean>): void;

  /**
   * Opens the view for a choice the person made, and while it is open brings its tab to the front of its group again, retitled for the choice. A view
   * with instances leaves the focus in the document; a plain view takes it, as `showView` does.
   * @param choice The choice, which titles the tab.
   */
  public showInFront(choice: T): void;

  /**
   * Brings the view to the front of its group for the choice of the followed document in front, titled for it; a view with instances leaves the focus
   * in the document, and a plain view takes it, as `showView` does. With no choice, the next followed document in front with a choice brings it,
   * unless a followed document in front is settled with none first.
   */
  public bringForward(): void;

  /**
   * Follows the person closing the view, so their next choice opens it again; the window part calls it once it registered the view.
   * @returns A function that stops following, which the window part calls when it deactivates.
   */
  public listen(): () => void;
}

/**
 * A pull request page's Commits tab: the pull request's commits with their short id, subject, author and age. A commit opens in the repository's history when
 * the open repository is the pull request's, and on the host's page otherwise.
 * Its selector is `nol-git-pull-request-commits`; a host module's pull request page shows it as a tab and gives it the host's reads through `host`.
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { HostReference } from "@noldova/git.hosting.protocol";
 * import { GitPullRequestCommitsComponent, type IGitPullRequestHost } from "@noldova/git.window";
 *
 * @Component({
 *   selector: "app-pull-request-tab",
 *   imports: [GitPullRequestCommitsComponent],
 *   template: "<nol-git-pull-request-commits [host]=\"host\" [reference]=\"reference\" [url]=\"url\" (counted)=\"count = $event\" />"
 * })
 * export class PullRequestTabComponent {
 *   protected readonly host: IGitPullRequestHost = {
 *     name: "Example", readCommitsMethod: "example.readPullRequestCommits", readChangesMethod: "example.readPullRequestChanges",
 *     readConflictsMethod: "example.readPullRequestConflicts", readThreadsMethod: "example.readPullRequestThreads", replyToThreadMethod: null,
 *     changeThreadMethod: null, localFolderAsync: async () => null, commitPageOf: (url, commitId) => `${url}/commits/${commitId}`, personAvatarOf: () => null
 *   };
 *   protected readonly reference: HostReference = new HostReference("example", "octocat", "hello-world", 7);
 *   protected readonly url: string = "https://example.com/octocat/hello-world/pulls/7";
 *   protected count: string = "";
 * }
 * ```
 */
export declare class GitPullRequestCommitsComponent {
  /**
   * Angular's factory for the component, as its compiler declares it.
   */
  public static ɵfac: ɵɵFactoryDeclaration<GitPullRequestCommitsComponent, never>;

  /**
   * Angular's metadata for the standalone component: its selector, its required signal inputs and its output, as its compiler declares it.
   */
  public static ɵcmp: ɵɵComponentDeclaration<GitPullRequestCommitsComponent, "nol-git-pull-request-commits", never, {
    "host": { "alias": "host"; "required": true; "isSignal": true };
    "reference": { "alias": "reference"; "required": true; "isSignal": true };
    "url": { "alias": "url"; "required": true; "isSignal": true };
  }, { "counted": "counted" }, never, never, true, never>;

  /**
   * The host that reads the tab's list and finds the pull request's repository on this computer.
   */
  public readonly host: InputSignal<IGitPullRequestHost>;

  /**
   * The pull request, by its host module's id, its repository and its number; another pull request reads again.
   */
  public readonly reference: InputSignal<HostReference>;

  /**
   * The pull request's page on its host, which the host reads to find the pull request's repository here.
   */
  public readonly url: InputSignal<string>;

  /**
   * The tab's count once read, such as `12`, or `250+` when the host has more than it shows.
   */
  public readonly counted: OutputEmitterRef<string>;
}

/**
 * A line of a file in a pull request's latest push, such as a comment thread's, which the pull request page's Files tab shows through its `reveal` input.
 * @example
 * ```ts
 * import { GitFileLine } from "@noldova/git.window";
 *
 * export const line: GitFileLine = new GitFileLine("src/app.ts", 42);
 * ```
 */
export declare class GitFileLine {
  /** The file's path from the repository's root, with `/` between folders and no leading `/`, such as `src/app.ts`. */
  public readonly path: string;
  /** The line's number in the file as the push leaves it, from 1. */
  public readonly line: number;

  public constructor(path: string, line: number);
}

/**
 * A pull request page's Files tab: the files its latest push changes. When the open repository is the pull request's and has that push's commits, it shows the
 * changes from local Git; otherwise it lists the paths the host names, never their contents, with a Fetch for a repository that lacks the commits.
 * Its selector is `nol-git-pull-request-files`; a host module's pull request page shows it as a tab and gives it the host's reads through `host`.
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { HostReference } from "@noldova/git.hosting.protocol";
 * import { GitPullRequestFilesComponent, type IGitPullRequestHost } from "@noldova/git.window";
 *
 * @Component({
 *   selector: "app-pull-request-tab",
 *   imports: [GitPullRequestFilesComponent],
 *   template: "<nol-git-pull-request-files [host]=\"host\" [reference]=\"reference\" [url]=\"url\" (counted)=\"count = $event\" />"
 * })
 * export class PullRequestTabComponent {
 *   protected readonly host: IGitPullRequestHost = {
 *     name: "Example", readCommitsMethod: "example.readPullRequestCommits", readChangesMethod: "example.readPullRequestChanges",
 *     readConflictsMethod: "example.readPullRequestConflicts", readThreadsMethod: "example.readPullRequestThreads", replyToThreadMethod: null,
 *     changeThreadMethod: null, localFolderAsync: async () => null, commitPageOf: (url, commitId) => `${url}/commits/${commitId}`, personAvatarOf: () => null
 *   };
 *   protected readonly reference: HostReference = new HostReference("example", "octocat", "hello-world", 7);
 *   protected readonly url: string = "https://example.com/octocat/hello-world/pulls/7";
 *   protected count: string = "";
 * }
 * ```
 */
export declare class GitPullRequestFilesComponent {
  /**
   * Angular's factory for the component, as its compiler declares it.
   */
  public static ɵfac: ɵɵFactoryDeclaration<GitPullRequestFilesComponent, never>;

  /**
   * Angular's metadata for the standalone component: its selector, its required signal inputs and its output, as its compiler declares it.
   */
  public static ɵcmp: ɵɵComponentDeclaration<GitPullRequestFilesComponent, "nol-git-pull-request-files", never, {
    "host": { "alias": "host"; "required": true; "isSignal": true };
    "reference": { "alias": "reference"; "required": true; "isSignal": true };
    "url": { "alias": "url"; "required": true; "isSignal": true };
    "answer": { "alias": "answer"; "required": false; "isSignal": true };
    "reveal": { "alias": "reveal"; "required": false; "isSignal": true };
  }, { "counted": "counted"; "unrevealed": "unrevealed" }, never, never, true, never>;

  /**
   * The host that reads the tab's list and finds the pull request's repository on this computer.
   */
  public readonly host: InputSignal<IGitPullRequestHost>;

  /**
   * The pull request, by its host module's id, its repository and its number; another pull request reads again.
   */
  public readonly reference: InputSignal<HostReference>;

  /**
   * The pull request's page on its host, which the host reads to find the pull request's repository here.
   */
  public readonly url: InputSignal<string>;

  /**
   * The files as the page already read them through `host.readChangesMethod`, such as to count them before the tab opens, which the tab's first read shows
   * instead of asking again; `null`, the default, to ask. Try again and another pull request ask anew.
   */
  public readonly answer: InputSignal<HostPullRequestFiles | null>;

  /**
   * A line to show once the tab has read, such as a comment thread's: the changes from local Git open its file and mark and scroll to the line, or to the file
   * when no hunk shows it. `null`, the default, shows none; another `GitFileLine` shows again.
   */
  public readonly reveal: InputSignal<GitFileLine | null>;

  /**
   * The tab's count once read, such as `12`, or `250+` when the host has more than it shows.
   */
  public readonly counted: OutputEmitterRef<string>;

  /**
   * A line given in `reveal` that the tab can't show, as the changes from local Git aren't here or don't hold its file, so the page can show it on the host.
   */
  public readonly unrevealed: OutputEmitterRef<GitFileLine>;
}

/**
 * A pull request page's Conflicts tab: the paths of the files that keep it from merging. When the open repository is the pull request's and is merging on its
 * source or target branch, a row opens that repository's Conflicts screen; otherwise rows are plain paths.
 * Its selector is `nol-git-pull-request-conflicts`; a host module's pull request page shows it as a tab and gives it the host's reads through `host`.
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { type HostChanges, HostReference } from "@noldova/git.hosting.protocol";
 * import { GitPullRequestConflictsComponent, type IGitPullRequestHost } from "@noldova/git.window";
 *
 * @Component({
 *   selector: "app-pull-request-tab",
 *   imports: [GitPullRequestConflictsComponent],
 *   template: "<nol-git-pull-request-conflicts [host]=\"host\" [reference]=\"reference\" [url]=\"url\" [changes]=\"changes\" (counted)=\"count = $event\" />"
 * })
 * export class PullRequestTabComponent {
 *   protected readonly host: IGitPullRequestHost = {
 *     name: "Example", readCommitsMethod: "example.readPullRequestCommits", readChangesMethod: "example.readPullRequestChanges",
 *     readConflictsMethod: "example.readPullRequestConflicts", readThreadsMethod: "example.readPullRequestThreads", replyToThreadMethod: null,
 *     changeThreadMethod: null, localFolderAsync: async () => null, commitPageOf: (url, commitId) => `${url}/commits/${commitId}`, personAvatarOf: () => null
 *   };
 *   protected readonly reference: HostReference = new HostReference("example", "octocat", "hello-world", 7);
 *   protected readonly url: string = "https://example.com/octocat/hello-world/pulls/7";
 *   protected readonly changes: HostChanges | null = null;
 *   protected count: string = "";
 * }
 * ```
 */
export declare class GitPullRequestConflictsComponent {
  /**
   * Angular's factory for the component, as its compiler declares it.
   */
  public static ɵfac: ɵɵFactoryDeclaration<GitPullRequestConflictsComponent, never>;

  /**
   * Angular's metadata for the standalone component: its selector, its required signal inputs and its output, as its compiler declares it.
   */
  public static ɵcmp: ɵɵComponentDeclaration<GitPullRequestConflictsComponent, "nol-git-pull-request-conflicts", never, {
    "host": { "alias": "host"; "required": true; "isSignal": true };
    "reference": { "alias": "reference"; "required": true; "isSignal": true };
    "url": { "alias": "url"; "required": true; "isSignal": true };
    "changes": { "alias": "changes"; "required": true; "isSignal": true };
  }, { "counted": "counted" }, never, never, true, never>;

  /**
   * The host that reads the tab's list and finds the pull request's repository on this computer.
   */
  public readonly host: InputSignal<IGitPullRequestHost>;

  /**
   * The pull request, by its host module's id, its repository and its number; another pull request reads again.
   */
  public readonly reference: InputSignal<HostReference>;

  /**
   * The pull request's page on its host, which the host reads to find the pull request's repository here.
   */
  public readonly url: InputSignal<string>;

  /**
   * The pull request's branches, whose merge the open repository may be in; `null` when the host didn't say.
   */
  public readonly changes: InputSignal<HostChanges | null>;

  /**
   * The tab's count once read, such as `12`, or `250+` when the host has more than it shows.
   */
  public readonly counted: OutputEmitterRef<string>;
}

/**
 * A comment thread on a line of a file, whose Go to line the person clicked in `GitPullRequestThreadsComponent`.
 * @example
 * ```ts
 * import { ThreadLine } from "@noldova/git.window";
 *
 * export const line: ThreadLine = new ThreadLine(3, "/src/app.ts", 42);
 * ```
 */
export declare class ThreadLine {
  /** The thread's id on its host. */
  public readonly threadId: number;
  /** The file's path as its host names it, such as Azure DevOps's `/src/app.ts` with a leading slash or GitHub's `src/app.ts`. */
  public readonly path: string;
  /** The line's number in the file, from 1. */
  public readonly line: number;

  public constructor(threadId: number, path: string, line: number);
}

/**
 * A pull request page's comment threads, oldest first: each thread's head with its state, the file's name and line, its full path as the tooltip and Go to
 * line for a thread on a line, then its comments with their author's picture, time and Markdown, a reply set in from the comment it answers. A resolved,
 * won't-fix, by-design or closed thread folds to its first comment until it is opened, and the head counts the active and pending threads. Under an open
 * thread, Reply and Resolve or Reactivate write through the host, each only when the host has its method, with no answer row when it has neither; resolving
 * the last open thread of a pull request that completes by itself asks first. When the host keeps older comments than it answered, the threads say so.
 * Its selector is `nol-git-pull-request-threads`; a host module's pull request page shows it and gives it the host's reads and writes through `host`.
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { HostReference } from "@noldova/git.hosting.protocol";
 * import { GitPullRequestThreadsComponent, type IGitPullRequestHost, type ThreadLine } from "@noldova/git.window";
 *
 * @Component({
 *   selector: "app-pull-request-threads",
 *   imports: [GitPullRequestThreadsComponent],
 *   template: "<nol-git-pull-request-threads [host]=\"host\" [reference]=\"reference\" (goToLine)=\"line = $event\" />"
 * })
 * export class PullRequestThreadsComponent {
 *   protected readonly host: IGitPullRequestHost = {
 *     name: "Example", readCommitsMethod: "example.readPullRequestCommits", readChangesMethod: "example.readPullRequestChanges",
 *     readConflictsMethod: "example.readPullRequestConflicts", readThreadsMethod: "example.readPullRequestThreads", replyToThreadMethod: null,
 *     changeThreadMethod: null, localFolderAsync: async () => null, commitPageOf: (url, commitId) => `${url}/commits/${commitId}`, personAvatarOf: () => null
 *   };
 *   protected readonly reference: HostReference = new HostReference("example", "octocat", "hello-world", 7);
 *   protected line: ThreadLine | null = null;
 * }
 * ```
 */
export declare class GitPullRequestThreadsComponent {
  /**
   * Angular's factory for the component, as its compiler declares it.
   */
  public static ɵfac: ɵɵFactoryDeclaration<GitPullRequestThreadsComponent, never>;

  /**
   * Angular's metadata for the standalone component: its selector, its signal inputs and its outputs, as its compiler declares it.
   */
  public static ɵcmp: ɵɵComponentDeclaration<GitPullRequestThreadsComponent, "nol-git-pull-request-threads", never, {
    "host": { "alias": "host"; "required": true; "isSignal": true };
    "reference": { "alias": "reference"; "required": true; "isSignal": true };
    "isAutoComplete": { "alias": "isAutoComplete"; "required": false; "isSignal": true };
    "references": { "alias": "references"; "required": false; "isSignal": true };
  }, { "linkOpen": "linkOpen"; "goToLine": "goToLine" }, never, never, true, never>;

  /**
   * The host that reads the threads, writes replies and changes, if it does, and finds each comment author's picture.
   */
  public readonly host: InputSignal<IGitPullRequestHost>;

  /**
   * The pull request whose comment threads it shows; another pull request reads again.
   */
  public readonly reference: InputSignal<HostReference>;

  /**
   * Whether the pull request completes by itself once its policies pass, so resolving its last open thread may merge it; `false` by default.
   */
  public readonly isAutoComplete: InputSignal<boolean>;

  /**
   * Finds the references the comments write, such as `AB#12` and `!8`, and shows them as chips; `null`, the default, shows the comments as they're written.
   */
  public readonly references: InputSignal<ILinkReferenceSource | null>;

  /**
   * A link a comment's Markdown asks to open, with the gesture that opened it.
   */
  public readonly linkOpen: OutputEmitterRef<LinkOpenEvent>;

  /**
   * A thread on a file's line whose Go to line the person clicked, for the page to show that line.
   */
  public readonly goToLine: OutputEmitterRef<ThreadLine>;
}

/**
 * Lets another module's page show a commit in a repository's history, such as a commit that names a work item.
 */
export declare class GitHistorySelection {
  /**
   * Opens the repository's history through the `git.openHistory` command and selects the commit there, scrolled into view, once the history has read
   * it; a history whose loaded commits don't hold it says so instead. A later ask replaces one the history hasn't taken yet.
   * @param context The asking window part's context, which runs the command.
   * @param folder The repository's folder, an absolute path of at most 4096 characters.
   * @param commitId The commit's full id.
   * @returns A promise that settles once the history is open.
   * @throws Rejects as the command does, such as when the Git module isn't active.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { GitHistorySelection } from "@noldova/git.window";
   *
   * export function showCommit(context: IWindowPartContext, folder: string, commitId: string): Promise<void> {
   *   return GitHistorySelection.selectAsync(context, folder, commitId);
   * }
   * ```
   */
  public static selectAsync(context: IWindowPartContext, folder: string, commitId: string): Promise<void>;
}

/**
 * The Git module's window part, which Noldova Desktop activates in each window; it registers the Git view, `git.view`, in the right dock.
 *
 * @example
 * ```ts
 * import { windowPart } from "@noldova/git.window";
 *
 * console.log(windowPart.moduleId);
 * ```
 */
export declare const windowPart: IWindowPart;
