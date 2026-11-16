/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
   * `git_github_read`: the agent tool that reads an issue or pull request on github.com by `owner`, `repository` and `number`, and answers
   * its `HostItem` JSON as untrusted text from `https://github.com`; it fails as `Unavailable` with the module code `git-github.signedOut`
   * when signed out and `git-github.notFound` when GitHub has no such item the account can see.
   */
  public static readonly readTool: string;

  /**
   * `git_github_pr_checks`: the agent tool that reads, for the branch checked out in the repository of the session's `git.folder`, its newest
   * pull request on github.com and the check runs of its HEAD commit, and answers the `BranchPullRequest` JSON as untrusted text from
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
}

/**
 * The answer of `IGitHubAccess.accessAsync` while signed in: the token the sign-in holds and the account's login.
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
   * Holds a token with its account's login.
   *
   * @param token The signed-in token.
   * @param login The signed-in account's login.
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
  public constructor(token: string, login: string);
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
 * answers the token the sign-in holds with the account's login, or why there is none: signed out, the kept sign-in unreadable, or a sign-in
 * still waiting for its code; only a module that names `git-github` as a dependency or an optional dependency can find it.
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
   * Answers the held token and the account's login as a `GitHubAccessGrant`, or why there is none as a `GitHubAccessRefusal`.
   *
   * @param signal Withdraws the call: an aborted signal rejects with its reason.
   */
  accessAsync(signal: AbortSignal): Promise<GitHubAccessGrant | GitHubAccessRefusal>;
}
