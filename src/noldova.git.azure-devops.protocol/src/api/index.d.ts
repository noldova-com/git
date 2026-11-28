/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostCapabilities } from "@noldova/git.hosting.protocol";

/**
 * The names the Azure DevOps module's parts share.
 *
 * @example
 * ```ts
 * import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
 *
 * console.log(AzureDevOpsNames.moduleId);
 * ```
 */
export declare class AzureDevOpsNames {
  /**
   * The module's id, as its module.json declares it.
   */
  public static readonly moduleId: string;

  /**
   * The method that answers the sign-in as `HostSignIn` JSON from `@noldova/git.hosting.protocol`.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
   * import { HostSignIn } from "@noldova/git.hosting.protocol";
   *
   * export async function readSignInAsync(context: IWindowPartContext): Promise<HostSignIn> {
   *   return HostSignIn.fromJson(await context.requestAsync(AzureDevOpsNames.readSignInMethod, null));
   * }
   * ```
   */
  public static readonly readSignInMethod: string;

  /**
   * The method that answers every Azure DevOps account kept on this computer as `HostAccountList` JSON, the first account first, each entry's
   * `place` naming its organization as `dev.azure.com/<organization>`, lowercase, while it signs in or is signed in.
   * The sign-in methods act on the first account when their payload names none: `readSignInMethod`, `cancelSignInMethod` and `signOutMethod` take
   * nothing or `AccountQuery` JSON, and `startSignInMethod` and `signInWithTokenMethod` take an `account` beside their fields. Signing out an account
   * other than the first removes it from the list.
   */
  public static readonly readAccountsMethod: string;

  /**
   * The method that adds an account: it takes what `startSignInMethod` or `signInWithTokenMethod` takes, `{ "organization": string }` or
   * `{ "token": string, "organization": string }`, signs the new account in that way and answers it as `HostAccountEntry` JSON, waiting in the
   * browser or signed in. An added account that ends signed out leaves the list; one that signs in to an organization as an account already kept
   * there ends signed out with `AlreadyKept` and leaves too. It fails as those methods do.
   */
  public static readonly addAccountMethod: string;

  /**
   * The method that takes a `RepositoryQuery` as JSON and answers the account the module reads the repository with as `RepositoryAccount` JSON:
   * the one the person chose for it while it is signed in to the repository's organization, else the first account signed in to that organization,
   * else none. A read through a reference, which names the repository by its id, takes the account last chosen in the organization instead.
   */
  public static readonly readRepositoryAccountMethod: string;

  /**
   * The method that takes an `AccountPick` as JSON, remembers the account for the repository on this computer, at most 200 repositories, and
   * answers the account the module now reads it with as `RepositoryAccount` JSON; it fails with `NotFound` for an account it doesn't keep.
   */
  public static readonly pickAccountMethod: string;

  /**
   * The method that takes `{ "organization": string }`, starts a sign-in with Microsoft for that organization and answers the sign-in waiting with
   * the https address the window opens in the person's browser; the browser comes back to a listener on this computer, which then asks the
   * organization who signed in, keeps the sign-in on this computer and publishes it signed in.
   * It fails with `Unauthorized` for any caller but the app's main process acting for a window; the sign-in ends signed out with `Denied` when the
   * person refuses consent, `Refused` when Microsoft or the organization refuses the sign-in, `Expired` after five minutes, or `Unreachable` when
   * Microsoft or the organization can't be reached.
   * The sign-in renews itself before it expires, and when Microsoft refuses the renewal it signs out with `Expired`, so the person signs in again.
   *
   * @example
   * ```ts
   * import { LinkPlace, type IWindowPartContext } from "@noldova/desktop.window";
   * import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
   * import { HostSignIn } from "@noldova/git.hosting.protocol";
   *
   * export async function startSignInAsync(context: IWindowPartContext, organization: string): Promise<void> {
   *   const signIn = HostSignIn.fromJson(await context.requestAsync(AzureDevOpsNames.startSignInMethod, { organization }));
   *   if (signIn.address !== null)
   *     await context.openLinkAsync(signIn.address, { place: LinkPlace.System });
   * }
   * ```
   */
  public static readonly startSignInMethod: string;

  /**
   * The method that stops a waiting sign-in with Microsoft and answers the sign-in, signed out; it answers the sign-in as it is when none waits.
   */
  public static readonly cancelSignInMethod: string;

  /**
   * The method that takes `{ "token": string, "organization": string }`, a personal access token the person made in Azure DevOps and the
   * organization it is for, asks the organization who the token is, keeps the token with the organization on this computer and answers the sign-in,
   * signed in; it fails with `Unauthorized` for any caller but the app's main process acting for a window, and answers the sign-in signed out with
   * `Refused` when the organization refuses the token or `Unreachable` when it can't be reached.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
   * import { HostSignIn } from "@noldova/git.hosting.protocol";
   *
   * export async function signInAsync(context: IWindowPartContext, token: string, organization: string): Promise<HostSignIn> {
   *   return HostSignIn.fromJson(await context.requestAsync(AzureDevOpsNames.signInWithTokenMethod, { token, organization }));
   * }
   * ```
   */
  public static readonly signInWithTokenMethod: string;

  /**
   * The method that stops a waiting sign-in, forgets the kept sign-in on this computer and answers the sign-in, signed out.
   */
  public static readonly signOutMethod: string;

  /**
   * The method that takes a `HostReference` as JSON, with the organization as its owner and the repository's id as its repository, and answers
   * the pull request as `HostItem` JSON, or null when signed out, when the reference's host isn't this module or when Azure DevOps can't show
   * it (404); a 401 signs out with `Revoked` and fails with `Unauthorized`.
   */
  public static readonly readReferenceMethod: string;

  /**
   * The method that takes a `BranchQuery` as JSON, with a `dev.azure.com` or `*.visualstudio.com` remote's host and path, and answers
   * `BranchPullRequest` JSON: the branch's newest pull request in any state, with its builds and policies as checks, its reviewers' votes as the
   * review decision and the votes above zero as its approvals; it answers no pull request when signed out or when the branch has none.
   */
  public static readonly readBranchPullRequestMethod: string;

  /**
   * The method that takes a `CommitQuery` as JSON, with a `dev.azure.com` or `*.visualstudio.com` remote's host and path, and answers
   * `BranchPullRequest` JSON as the branch read does: the pull request holding the commit, or else the one whose merge made it, found with one
   * pull request query; it answers no pull request when signed out or when none brought the commit in.
   */
  public static readonly readCommitPullRequestMethod: string;

  /**
   * The method that takes a `HostReference` as JSON, as the reference read does, and answers the pull request with its reviewers and their
   * votes, its policies, its builds and whether it completes by itself, as `HostPullRequest` JSON, or null as the reference read does.
   */
  public static readonly readPullRequestMethod: string;

  /**
   * The method that takes a `WorkItemQuery` as JSON and answers the work item with its type's name, colour and icon, its state and the state's
   * category, its assignee, iteration, area and parent, as `HostWorkItem` JSON; null when signed out, when the query is another host's, or when the
   * item doesn't exist or the account can't see it.
   */
  public static readonly readWorkItemMethod: string;

  /**
   * The method that takes a `WorkItemsQuery` as JSON and answers the work items in its scope, the signed-in person's open ones or the ones with its ids,
   * each with its links, as a JSON array of `HostWorkItemDetail`, parents before their children; empty signed out or for another host or organization.
   * The signed-in person's ones merge every account signed in to the organization, each naming its account while more than one is signed in.
   */
  public static readonly readWorkItemsMethod: string;

  /**
   * The method that takes a `WorkItemUpdate` as JSON, moves the work item to the new state, assigns it to the signed-in person or both, and answers
   * the work item as `HostWorkItemDetail` JSON. It writes to the person's account, so it fails with `Unauthorized` for any caller but the app's
   * main process acting for a window, where the person asked for the change; it fails with `Unauthorized` too when the token can't write work
   * items, and with `NotFound` when Azure DevOps doesn't show the work item.
   */
  public static readonly updateWorkItemMethod: string;

  /**
   * `git-azure-devops.readAuthorAvatar`: takes an `AuthorQuery` as JSON, with `dev.azure.com` as its host and the organization as its path, and
   * answers the author's Azure DevOps picture as `HostAvatar` JSON: signed in to that organization, the picture of its user whose email is the
   * author's, unless Azure DevOps made that picture itself; else none.
   */
  public static readonly readAuthorAvatarMethod: string;

  /**
   * `git-azure-devops.readPersonAvatar`: takes a `PersonQuery` as JSON, with `dev.azure.com` as its host, the organization as its path and the
   * person's sign-in email as its login, and answers their Azure DevOps picture as `HostAvatar` JSON: signed in to that organization, the picture
   * of its user with that email, unless Azure DevOps made that picture itself; else, and for a login that isn't an email, none.
   */
  public static readonly readPersonAvatarMethod: string;

  /**
   * `git-azure-devops.readPullRequests`: takes a `RepositoryQuery` as JSON for a remote on Azure DevOps and answers the repository's active pull
   * requests as `HostPullRequestList` JSON, the newest first, each with its approving votes, its builds and blocking policies as checks and its
   * source branch, without `refs/heads/`, as its head branch; signed
   * out, the signed-out list, and for another organization or host, none.
   */
  public static readonly readPullRequestsMethod: string;

  /**
   * `git-azure-devops.readPullRequestHeads`: takes a `RepositoryQuery` as JSON like `readPullRequests` and answers the repository's active pull
   * requests as `HostPullRequestHeads` JSON, the newest first, at most 100 and whether there are more, each with its title, page, and head and base
   * branch but no approvals or checks, from one read of the list, for finding stacks; signed out, the signed-out list, and for another organization
   * or host, none.
   */
  public static readonly readPullRequestHeadsMethod: string;

  /**
   * `git-azure-devops.readPullRequestCommits`: takes a pull request's `HostReference` as JSON and answers the commits it brings as
   * `HostPullRequestCommits` JSON, the newest first, at most 250 and whether there are more; signed out, or for another host, organization or
   * repository id, none.
   */
  public static readonly readPullRequestCommitsMethod: string;

  /**
   * `git-azure-devops.readPullRequestUpdates`: takes a pull request's `HostReference` as JSON and answers its pushes as `HostPullRequestUpdates` JSON,
   * the newest first, at most 100 and whether there are more, each with who pushed it and when, its head and common commits and the commits it
   * added; signed out, or for another host, organization or repository id, none.
   */
  public static readonly readPullRequestUpdatesMethod: string;

  /**
   * `git-azure-devops.readPullRequestChanges`: takes a pull request's `HostReference` as JSON and answers the files it changes at its latest push as
   * `HostPullRequestFiles` JSON: each file's path and what the pull request did to it, never its contents, at most 5000 and whether there are more,
   * with that push's head commit and the commit its changes count from; signed out, or for another host, organization or repository id, none.
   */
  public static readonly readPullRequestChangesMethod: string;

  /**
   * `git-azure-devops.readPullRequestConflicts`: takes a pull request's `HostReference` as JSON and answers the paths of the files that keep it from
   * merging as `HostPullRequestConflicts` JSON, at most 100 and whether there are more; signed out, or for another host, organization or repository
   * id, none.
   */
  public static readonly readPullRequestConflictsMethod: string;

  /**
   * `git-azure-devops.readReviewRequests`: takes a `RepositoryQuery` as JSON for a remote on Azure DevOps and answers the repository's active pull
   * requests that list the signed-in person as a reviewer who hasn't voted, as `HostReviewRequestList` JSON, the newest first; a review asked of a
   * group the person is in isn't among them. The rows merge every account signed in to the remote's organization, each naming its account while
   * more than one is signed in. Signed out, the signed-out list, and for another organization or host, none.
   */
  public static readonly readReviewRequestsMethod: string;

  /**
   * `git-azure-devops.readCommitComments`: takes a `CommitQuery` as JSON for a remote on Azure DevOps and answers the comments on that commit as
   * `HostCommitComments` JSON: in the pull request that brought it in, the people's comments in the threads made on the iteration whose source
   * commit it is, and the page that shows them, kept only when it is an https page of the query's organization. Signed out, for another
   * organization or host, or with no pull request, none.
   */
  public static readonly readCommitCommentsMethod: string;

  /**
   * `git-azure-devops.readPullRequestThreads`: takes a pull request's `HostReference` as JSON and answers its comment threads as `HostPullRequestThreads`
   * JSON, every thread with `hasMore` false, keeping only people's text comments that aren't deleted, so the threads Azure DevOps writes for votes, pushes
   * and policies are left out; signed out, or for another organization or host, no threads.
   */
  public static readonly readPullRequestThreadsMethod: string;

  /**
   * The method that takes `{ "host": string, "path": string, "id": number, "branch": string }`, an Azure DevOps remote's host and path, a work
   * item's id in the remote's organization and a branch's name, and links the branch to the work item in Azure DevOps, answering null. It writes
   * to the person's account, so it fails with `Unauthorized` for any caller but the app's main process acting for a window, where the person
   * confirmed the link; it fails with `Unauthorized` too when the token can't write work items, and with `NotFound` when Azure DevOps doesn't
   * show the repository or the work item.
   */
  public static readonly linkBranchMethod: string;

  /**
   * The method that takes `{ "reference": HostReference, "thread": number, "parent": number, "body": string }`, a pull request's reference, one
   * of its threads, the comment the reply answers and the reply's Markdown, at most 150,000 characters, and posts the reply to the thread,
   * answering the new `HostComment`. It writes to the person's account, so it fails with `Unauthorized` for any caller but the app's main process
   * acting for a window, where the person pressed Reply; it fails with `Unauthorized` too when the token can't write code, and with `NotFound`
   * when Azure DevOps doesn't show the thread.
   */
  public static readonly replyToThreadMethod: string;

  /**
   * The method that takes `{ "reference": HostReference, "thread": number, "state": "Active" | "Resolved" }` and sets the thread's state in
   * Azure DevOps, Resolved as fixed, answering null. It fails as `replyToThreadMethod` does.
   */
  public static readonly changeThreadMethod: string;

  /**
   * The method that takes `{ "reference": HostReference, "vote": 10 | 5 | 0 | -5 | -10 }` and sets the signed-in person's vote on the pull request
   * in Azure DevOps, adding them as a reviewer when they aren't one: 10 approves, 5 approves with suggestions, 0 resets the vote, -5 waits for the
   * author and -10 rejects. It answers the person as `HostReviewer` JSON. It fails as `replyToThreadMethod` does, and with `NotFound` when Azure
   * DevOps doesn't show the pull request.
   */
  public static readonly voteMethod: string;

  /**
   * The method that takes a `HostReference` as JSON and answers the merge types the pull request's target branch allows, as a string array in the
   * order `noFastForward`, `squash`, `rebase`, `rebaseMerge`: those every "Limit merge types" policy on it allows, or all four when none applies; or
   * null as the reference read does.
   */
  public static readonly readMergeTypesMethod: string;

  /**
   * The method that takes `{ "reference": HostReference, "sourceCommit": string, "targetBranch": string, "mergeType": string, "message": string | null,
   * "completeWorkItems": boolean, "deleteSourceBranch": boolean }` and completes the pull request in Azure DevOps as the signed-in person: the last merge
   * source commit's 40-character id and the target branch the page showed, one of the merge types {@link readMergeTypesMethod} lists, the merge commit's
   * message, at most 4,000 characters, or null for `rebase` alone, whether to complete its linked work items and whether to delete its source branch.
   * It reads the pull request first and fails with `Conflict` and why when it isn't active, is a draft, has no clean merge, has another commit or target
   * than the page showed, or when the policy doesn't allow the merge type; it never bypasses a policy. It answers null. It fails as
   * `replyToThreadMethod` does, and with `NotFound` when Azure DevOps doesn't show the pull request.
   */
  public static readonly completePullRequestMethod: string;

  /**
   * The method that takes what {@link completePullRequestMethod} takes and sets the pull request to complete by itself, as the signed-in person, once
   * its required policies pass, with those choices. It reads the pull request first and fails with `Conflict` and why when it isn't active, is a draft,
   * has another commit or target than the page showed, or when the policy doesn't allow the merge type; unlike completing, it needs no clean merge
   * yet, and it never bypasses a policy. It answers null and fails as {@link completePullRequestMethod} does.
   */
  public static readonly setAutoCompleteMethod: string;

  /**
   * The method that takes a `HostReference` as JSON and stops the pull request from completing by itself. It reads the pull request first and fails
   * with `Conflict` when it isn't active. It answers null, and fails as `replyToThreadMethod` does, and with `NotFound` when Azure DevOps doesn't show
   * the pull request.
   */
  public static readonly cancelAutoCompleteMethod: string;

  /**
   * The method that takes `{ "reference": HostReference, "sourceCommit": string }` and abandons the pull request in Azure DevOps as the signed-in person,
   * with the last merge source commit's 40-character id the page showed. It reads the pull request first and fails with `Conflict` and why when it
   * isn't active or has another commit. It answers null and fails as {@link cancelAutoCompleteMethod} does.
   */
  public static readonly abandonPullRequestMethod: string;

  /**
   * The method that takes `{ "reference": HostReference, "query": string }`, a pull request's reference and 3 to 100 characters, and answers up to
   * 10 people and groups of the pull request's organization whose name or email Azure DevOps matches, each as
   * `{ "descriptor": string, "name": string, "login": string, "isGroup": boolean }`, or none when the token belongs to another organization or none is kept. It lists
   * the organization's people, so it fails with `Unauthorized` for any caller but the app's main process acting for a window.
   */
  public static readonly searchPeopleMethod: string;

  /**
   * The method that takes `{ "reference": HostReference, "descriptor": string }`, a pull request's reference and a descriptor `searchPeopleMethod`
   * answered, and adds that person or group to the pull request's reviewers as optional, without a vote, answering the reviewer as `HostReviewer`
   * JSON. It fails as `replyToThreadMethod` does, and with `NotFound` when Azure DevOps doesn't find the person or the pull request.
   */
  public static readonly addReviewerMethod: string;

  /**
   * The event that carries the sign-in as `HostSignIn` JSON each time it changes.
   */
  public static readonly signInChangedEvent: string;

  /**
   * The event that carries every account as `HostAccountList` JSON each time one is added, signs in, signs out or leaves.
   */
  public static readonly accountsChangedEvent: string;

  /**
   * What the module offers today: a sign-in, reading a pull request and a branch's pull request, checks, votes, policies, builds, a pull
   * request that completes by itself, work items, authors' pictures and a repository's open pull requests.
   */
  public static readonly capabilities: HostCapabilities;
}
