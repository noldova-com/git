/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostCapabilities } from "@noldova/git.hosting.protocol";

/**
 * The names the GitHub module's parts share.
 *
 * @example
 * ```ts
 * import { GitHubNames } from "@noldova/git.github.protocol";
 *
 * console.log(GitHubNames.moduleId);
 * ```
 */
export declare class GitHubNames {
  /**
   * The module's id, as its module.json declares it.
   */
  public static readonly moduleId: string;

  /**
   * The public client id of Noldova's OAuth app on GitHub, which the device sign-in names; the app has no client secret.
   */
  public static readonly clientId: string;

  /**
   * The method that answers the sign-in as `HostSignIn` JSON from `@noldova/git.hosting.protocol`.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { GitHubNames } from "@noldova/git.github.protocol";
   * import { HostSignIn } from "@noldova/git.hosting.protocol";
   *
   * export async function readSignInAsync(context: IWindowPartContext): Promise<HostSignIn> {
   *   return HostSignIn.fromJson(await context.requestAsync(GitHubNames.readSignInMethod, null));
   * }
   * ```
   */
  public static readonly readSignInMethod: string;

  /**
   * The method that starts a device sign-in and answers the sign-in, which then waits with its code; a sign-in that already waits or is signed
   * in stays as it is.
   */
  public static readonly startSignInMethod: string;

  /**
   * The method that stops a sign-in that waits and answers the sign-in, signed out with no failure; it changes nothing otherwise.
   */
  public static readonly cancelSignInMethod: string;

  /**
   * The method that stops a sign-in that waits, forgets the kept token on this computer and answers the sign-in, signed out.
   */
  public static readonly signOutMethod: string;

  /**
   * The method that takes a `HostReference` as JSON and answers the pull request or issue as `HostItem` JSON, or null when signed out, when the
   * reference's host isn't `github.com`, or when GitHub can't show it (404); answers are cached, fresh for 60 seconds and then revalidated
   * with `If-None-Match`, and a 401 signs out with `Revoked` and fails with `Unauthorized`.
   */
  public static readonly readReferenceMethod: string;

  /**
   * The method that takes a `BranchQuery` as JSON, with the repository's path as `owner/repository`, and answers `BranchPullRequest` JSON: the
   * branch's newest pull request in that repository, with the check runs of the query's head commit, or of the pull request's head when it is
   * null; it answers no pull request when signed out or when the branch has none.
   */
  public static readonly readBranchPullRequestMethod: string;

  /**
   * The method that takes a `PullRequestDraft` as JSON, opens the pull request on GitHub and answers it as `HostItem` JSON; it fails with
   * `Unauthorized` for any caller but the app's main process acting for a window and when signed out, with `Conflict` when GitHub refuses
   * the pull request (422), such as when one is already open for the branch, and with `InvalidParams` for a repository not on `github.com`.
   */
  public static readonly createPullRequestMethod: string;

  /**
   * `git-github.readAuthorAvatar`: takes an `AuthorQuery` as JSON and answers the author's GitHub picture as `HostAvatar` JSON: for a GitHub
   * no-reply email, the account it names, and signed in, the account GitHub links to the commit; else, and for a repository not on
   * `github.com`, none.
   */
  public static readonly readAuthorAvatarMethod: string;

  /**
   * `git-github.readPullRequests`: takes a `RepositoryQuery` as JSON and answers the repository's open pull requests as `HostPullRequestList` JSON,
   * the most recently updated first, each with its approving reviewers, the check runs on its head commit and its head branch; signed out, the signed-out list,
   * and for a repository not on `github.com`, none.
   */
  public static readonly readPullRequestsMethod: string;

  /**
   * `git-github.readReviewRequests`: takes a `RepositoryQuery` as JSON and answers the open pull requests on that repository that ask the signed-in
   * person for a review, their own or one of their teams', as `HostReviewRequestList` JSON, the newest first. It reads one search of the account's
   * review requests at most once a minute and shares it out by repository, so `hasMore` says the account's search was cut; signed out, the signed-out
   * list, and for a repository not on `github.com`, none.
   */
  public static readonly readReviewRequestsMethod: string;

  /**
   * `git-github.readCommitComments`: takes a `CommitQuery` as JSON and answers the review comments on that commit as `HostCommitComments` JSON: the
   * commit's own comments and, in the pull request that brought it in, the review comments made on it, one page of 100 of each, and the page that
   * shows them, kept only when it is an https page on `github.com`. Signed out, for a repository not on `github.com`, or with no comments, none.
   */
  public static readonly readCommitCommentsMethod: string;

  /**
   * `git-github.readPullRequest`: takes a `HostReference` as JSON and answers its pull request as `HostPullRequest` JSON: the pull request, its
   * description, its commit count, its reviewers by their latest review, the check runs on its head as builds, and whether it conflicts with its base;
   * no policies or work items, which GitHub doesn't have. Signed out, for another host, or for a pull request GitHub can't show, `null`.
   */
  public static readonly readPullRequestMethod: string;

  /**
   * `git-github.readPullRequestThreads`: takes a `HostReference` as JSON and answers its comments as `HostPullRequestThreads` JSON, the threads oldest
   * first: each conversation comment its own thread with no path, and each review comment with its replies a thread on its file and line, with no
   * state, since GitHub's REST API keeps none; the newest 100 of each kind, with `hasMore` when there are older ones. Signed out, for another host, or
   * for a pull request GitHub can't show, no threads.
   */
  public static readonly readPullRequestThreadsMethod: string;

  /**
   * `git-github.readAccounts`: answers every GitHub account kept on this computer as `HostAccountList` JSON, the first account first.
   * The sign-in methods take nothing for the first account, or `AccountQuery` JSON for another.
   */
  public static readonly readAccountsMethod: string;

  /**
   * `git-github.addAccount`: starts a device-code sign-in for a new account and answers it as `HostAccountEntry` JSON.
   */
  public static readonly addAccountMethod: string;

  /**
   * `git-github.readRepositoryAccount`: takes a `RepositoryQuery` as JSON and answers the account the module reads the repository with as
   * `RepositoryAccount` JSON: the one the person chose for it, else the first signed-in account that can read it, else the first signed-in account.
   */
  public static readonly readRepositoryAccountMethod: string;

  /**
   * `git-github.pickAccount`: takes an `AccountPick` as JSON, remembers the account for the repository on this computer, at most 200 repositories,
   * and answers the account the module now reads it with as `RepositoryAccount` JSON.
   */
  public static readonly pickAccountMethod: string;

  /**
   * `git-github.access`: the service the GitHub runtime part publishes as an `IGitHubAccess`, through which another module's runtime part,
   * such as an app's for GitHub's own MCP server, reads the signed-in token.
   */
  public static readonly accessService: string;

  /**
   * The event that carries the sign-in as `HostSignIn` JSON each time it changes.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { GitHubNames } from "@noldova/git.github.protocol";
   *
   * export function followSignIn(context: IWindowPartContext): () => void {
   *   return context.onEvent(GitHubNames.signInChangedEvent, t => console.log(t));
   * }
   * ```
   */
  public static readonly signInChangedEvent: string;

  /**
   * `git-github.accountsChanged`: carries every account as `HostAccountList` JSON each time one is added, signs in, signs out or leaves.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { GitHubNames } from "@noldova/git.github.protocol";
   *
   * export function followAccounts(context: IWindowPartContext): () => void {
   *   return context.onEvent(GitHubNames.accountsChangedEvent, t => console.log(t));
   * }
   * ```
   */
  public static readonly accountsChangedEvent: string;

  /**
   * `git_github_read`: the agent tool that reads an issue or pull request on github.com by `owner`, `repository` and `number`, and answers
   * its `HostItem` JSON as untrusted text from `https://github.com`; it fails as `Unavailable` with the module code `git-github.signedOut`
   * when signed out and `git-github.notFound` when GitHub has no such item the account can see.
   */
  public static readonly readTool: string;

  /**
   * `git_github_pr_checks`: the agent tool that reads, for the branch checked out in the repository of the session's `git.folder`, its newest
   * pull request on github.com, the check runs of its HEAD commit and where its review stands, and answers the `BranchPullRequest` JSON as untrusted text from
   * `https://github.com`.
   */
  public static readonly prChecksTool: string;

  /**
   * `git_github_pr_create`: the agent tool that opens a pull request on github.com from the branch checked out in the repository of the
   * session's `git.folder` into `base`, with `title`, `body` and `draft`, after the person allows the permission request
   * `git-github.createPullRequest` for that repository, and answers the opened pull request's `HostItem` JSON.
   */
  public static readonly prCreateTool: string;

  /**
   * GitHub's page where the person reviews or revokes the access they gave Noldova's OAuth app.
   */
  public static readonly manageAccessUrl: string;

  /**
   * What the module does today, so a window shows only that: sign-in, reading an item and a branch's pull request with its checks, opening
   * a pull request, showing commit authors' pictures and listing a repository's open pull requests.
   */
  public static readonly capabilities: HostCapabilities;
}

/**
 * The answer of `IGitHubAccess.accessAsync` and `accessForAsync` while signed in: the token the sign-in holds, the account's login and its host.
 * It holds no `reason`, so a module that takes only types from this package tells it from a `GitHubAccessRefusal` by `"token" in answer`.
 *
 * @example
 * ```ts
 * import { GitHubAccessGrant } from "@noldova/git.github.protocol";
 *
 * export function grantOf(token: string): GitHubAccessGrant {
 *   return new GitHubAccessGrant(token, "example-user");
 * }
 * ```
 */
export declare class GitHubAccessGrant {
  /**
   * The signed-in token, passed only to GitHub and never logged or shown.
   */
  public readonly token: string;

  /**
   * The signed-in account's login.
   */
  public readonly login: string;

  /**
   * The host the account signs in to, `github.com` unless it is a GitHub Enterprise server's.
   */
  public readonly host: string;

  /**
   * Holds a token with its account's login and host.
   *
   * @param token The signed-in token.
   * @param login The signed-in account's login.
   * @param host The host the account signs in to, `github.com` by default.
   *
   * @example
   * ```ts
   * import { GitHubAccessGrant } from "@noldova/git.github.protocol";
   *
   * export function loginOf(token: string): string {
   *   return new GitHubAccessGrant(token, "example-user").login;
   * }
   * ```
   */
  public constructor(token: string, login: string, host?: string);
}

/**
 * The answer of `IGitHubAccess.accessAsync` when there is no token: a sentence saying why, for the person.
 * It holds no `token`, so `"token" in answer` is false for it.
 *
 * @example
 * ```ts
 * import { GitHubAccessRefusal } from "@noldova/git.github.protocol";
 *
 * export function refusalOf(reason: string): GitHubAccessRefusal {
 *   return new GitHubAccessRefusal(reason);
 * }
 * ```
 */
export declare class GitHubAccessRefusal {
  /**
   * Why there is no token: signed out, the kept sign-in unreadable, or a sign-in still waiting for its code.
   */
  public readonly reason: string;

  /**
   * Holds why there is no token.
   *
   * @param reason The sentence that says why.
   *
   * @example
   * ```ts
   * import { GitHubAccessRefusal } from "@noldova/git.github.protocol";
   *
   * export function signedOutReason(): string {
   *   return new GitHubAccessRefusal("Sign in to GitHub in Settings, GitHub.").reason;
   * }
   * ```
   */
  public constructor(reason: string);
}

/**
 * The GitHub sign-in's token for another module's runtime part, published as `git-github.access`. It
 * answers the token an account holds with the account's login, or why there is none: signed out, the kept sign-in unreadable, or a sign-in
 * still waiting for its code; only a module that names `git-github` as a dependency or an optional dependency can find it.
 * The person may keep several accounts: `accessAsync` answers the first, and `accessForAsync` the one the module reads a repository with.
 * The token is never logged or shown; a module that reads it passes it only to GitHub, keeps it in memory only for that request, and reads it
 * again for the next one, so signing out stops the next request. A module that names `git-github` as an optional dependency finds it with
 * `context.findService` and a guard of its own, since it takes only types from this package.
 *
 * @example
 * ```ts
 * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
 * import { GitHubNames, type IGitHubAccess } from "@noldova/git.github.protocol";
 *
 * const isAccess = (t: object): t is IGitHubAccess => "accessAsync" in t && typeof t.accessAsync === "function";
 *
 * export async function readTokenAsync(context: IRuntimePartContext, signal: AbortSignal): Promise<string | null> {
 *   const answer = await context.findService(GitHubNames.accessService, isAccess)?.accessAsync(signal);
 *   return answer !== undefined && "token" in answer ? answer.token : null;
 * }
 * ```
 */
export interface IGitHubAccess {
  /**
   * Answers the first account's token and login as a `GitHubAccessGrant`, or why there is none as a `GitHubAccessRefusal`.
   *
   * @param signal Withdraws the call: an aborted signal rejects with its reason.
   */
  accessAsync(signal: AbortSignal): Promise<GitHubAccessGrant | GitHubAccessRefusal>;

  /**
   * Answers the token and login of the account the module reads the repository with, as a `GitHubAccessGrant`: the one the person chose for it,
   * else the first signed-in account that can read it, else the first signed-in account. With none signed in, it answers why, as
   * `accessAsync` does for the first account.
   *
   * @param repository The repository's host, such as `github.com`, and its path, such as `octocat/hello-world`.
   * @param signal Withdraws the call: an aborted signal rejects with its reason.
   * @example
   * ```ts
   * import type { IGitHubAccess } from "@noldova/git.github.protocol";
   *
   * export async function loginForAsync(access: IGitHubAccess, signal: AbortSignal): Promise<string | null> {
   *   const answer = await access.accessForAsync({ host: "github.com", path: "octocat/hello-world" }, signal);
   *   return "login" in answer ? answer.login : null;
   * }
   * ```
   */
  accessForAsync(repository: { readonly host: string; readonly path: string }, signal: AbortSignal): Promise<GitHubAccessGrant | GitHubAccessRefusal>;
}
