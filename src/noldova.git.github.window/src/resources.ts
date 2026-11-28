/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CheckState, type HostAccount, type ReferenceKind, type ReferenceState, SignInFailure } from "@noldova/git.hosting.protocol";
import type { IconName } from "@noldova/ui.components.angular";

export class Resources {
  public static readonly accountsPage: string = "git.accounts";
  public static readonly pullRequestsUnanswered: string = "GitHub didn't answer. Try again to read this repository's pull requests.";
  public static readonly commitPullRequestUnanswered: string = "GitHub didn't answer. Its pull request reads again when the commit opens again.";
  public static readonly accountId: string = "git-github.account";
  public static readonly hostName: string = "GitHub";
  public static readonly hostColumn: string = "GitHub";
  public static readonly hostMark: string = "GH";
  public static readonly hostColor: string = "#24292f";
  public static readonly enterpriseAccountId: string = "git-github.enterprise";
  public static readonly enterpriseHostName: string = "GitHub Enterprise";
  public static readonly enterpriseColumn: string = "GitHub Enterprise";
  public static readonly enterpriseTitle: string = "GitHub Enterprise account";
  public static readonly enterpriseNote: string = "Connect an account on your company's GitHub Enterprise server with a personal access token.";
  public static readonly enterpriseCardNote: string = "Connect an account on a GitHub Enterprise server with a personal access token.";
  public static readonly connectAction: string = "Connect";
  public static readonly connectIcon: IconName = "link";
  public static readonly serverLabel: string = "GitHub Enterprise server";
  public static readonly serverPlaceholder: string = "github.example.com";
  public static readonly tokenLabel: string = "Personal access token";
  public static readonly tokenPlaceholder: string = "Paste the personal access token";
  public static readonly tokenNote: string = "Create the token on the server's page; it opens with the repo scope ticked and the token named for this app.";
  public static readonly makeToken: string = "Create a token on the server";
  public static readonly manageTokens: string = "Manage tokens on the server";
  public static readonly connectUnanswered: string = "The GitHub module didn't answer the connect.";
  public static readonly tokenDescription: string = "Noldova Git";
  public static readonly signedIn: string = "Signed in";
  public static readonly waiting: string = "Waiting for the code";
  public static readonly signInAction: string = "Sign in";
  public static readonly accountTitle: string = "Account";
  public static readonly firstAccount: number = 1;
  public static readonly addAccount: string = "Add another GitHub account";
  public static readonly addAccountIcon: IconName = "person_add";
  public static readonly addAccountUnanswered: string = "GitHub didn't add the account.";
  public static readonly signedOutNote: string = "Sign in to see pull requests, their checks, and issue and pull request links in replies. Git works without it.";
  public static readonly signIn: string = "Sign in to GitHub";
  public static readonly signInIcon: IconName = "login";
  public static readonly copyCode: string = "Copy code";
  public static readonly copyIcon: IconName = "content_copy";
  public static readonly openAgain: string = "Open the page again";
  public static readonly openIcon: IconName = "open_in_new";
  public static readonly cancel: string = "Cancel";
  public static readonly signOut: string = "Sign out";
  public static readonly signOutIcon: IconName = "logout";
  public static readonly manageAccess: string = "Manage access on GitHub";
  public static readonly failureIcon: IconName = "error";
  public static readonly repositoryScope: string = "repo";
  public static readonly withRepositories: string = "Signed in on this computer · access to your repositories";
  public static readonly withoutRepositories: string = "Signed in on this computer · no access to your repositories";
  public static readonly addressPrefix: RegExp = /^https:\/\//;
  public static readonly secondMilliseconds: number = 1_000;
  public static readonly minuteSeconds: number = 60;
  public static readonly pullRequestLabel: string = "Pull request";
  public static readonly issueLabel: string = "Issue";
  public static readonly openLabel: string = "Open";
  public static readonly draftLabel: string = "Draft";
  public static readonly mergedLabel: string = "Merged";
  public static readonly closedLabel: string = "Closed";
  public static readonly openColor: string = "var(--nol-status-ok)";
  public static readonly mutedColor: string = "var(--nol-text-muted)";
  public static readonly closedColor: string = "var(--nol-status-failed)";
  public static readonly doneLightColor: string = "#8250DF";
  public static readonly doneDarkColor: string = "#A371F7";
  public static readonly fillPercent: number = 16;
  public static readonly closedFillPercent: number = 14;
  public static readonly doneLightFillPercent: number = 14;
  public static readonly doneDarkFillPercent: number = 18;
  public static readonly svgImagePrefix: string = "data:image/svg+xml,";
  public static readonly ariaTrue: string = "true";

  public static readonly pullRequestOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/></svg>';
  public static readonly pullRequestDraftOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"/></svg>';
  public static readonly mergedOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z"/></svg>';
  public static readonly pullRequestClosedOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>';
  public static readonly issueOpenedOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/></svg>';
  public static readonly issueClosedOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z"/><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"/></svg>';
  public static readonly notPlannedOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm9.78-2.22-5.5 5.5a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l5.5-5.5a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"/></svg>';
  public static readonly checkSucceededOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-.018-1.042.751.751 0 0 0-1.042-.018L6.75 9.19 5.28 7.72a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042l2 2a.75.75 0 0 0 1.06 0Z"/></svg>';
  public static readonly checkFailedOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M2.343 13.657A8 8 0 1 1 13.658 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94Z"/></svg>';
  public static readonly checkRunningOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/></svg>';
  public static readonly checkQueuedOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/></svg>';
  public static readonly markOcticon: string = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656"/></svg>';

  public static readonly gitHubHost: string = "github.com";
  public static readonly gitHubReferenceProtocol: string = "https:";
  public static readonly gitHubIssuesSegment: string = "issues";
  public static readonly gitHubPullSegment: string = "pull";
  public static readonly gitHubCompareSegment: string = "compare";
  public static readonly gitHubFilesSegment: string = "files";
  public static readonly gitHubAppsSegment: string = "apps";
  public static readonly gitHubOwnerPattern: RegExp = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
  public static readonly gitHubRepositoryPattern: RegExp = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;
  public static readonly gitHubNumberPattern: RegExp = /^[1-9][0-9]{0,9}$/;
  public static readonly gitHubTextReferencePattern: RegExp =
    /(?<![\w./#&-])(?:[A-Za-z0-9][A-Za-z0-9-]{0,38}\/(?!\.{1,2}#)[A-Za-z0-9._-]{1,100})?#[1-9][0-9]{0,9}(?![\w-])/gu;
  public static readonly gitHubHomePattern: RegExp = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;
  public static readonly gitHubTextNumberMark: string = "#";
  public static readonly gitHubReferenceReadLimit: number = 4;
  public static readonly gitHubReferenceMemoryLimit: number = 500;
  public static readonly gitHubBotSuffix: string = "[bot]";
  public static readonly slash: string = "/";
  public static readonly hostRowSignedOut: string = "Sign in to GitHub to see this branch's pull request and its checks.";
  public static readonly readingPullRequest: string = "Reading this branch's pull request on GitHub.";
  public static readonly noPullRequest: string = "No pull request for this branch";
  public static readonly unanswered: string = "GitHub didn't answer. Try again to read this branch's pull request.";
  public static readonly hostRowSignInUnanswered: string = "GitHub's sign-in didn't answer. Try again.";
  public static readonly accountNotSwitched: string = "GitHub didn't switch the account. Try again.";
  public static readonly switchAccount: string = "Switch account";
  public static readonly hostRowLinkNotOpened: string = "The page couldn't be opened; the app's log has the details.";
  public static readonly signInUnanswered: string = "GitHub's sign-in didn't answer.";
  public static readonly linkNotOpened: string = "The page couldn't be opened.";
  public static readonly requestFailedHint: string = "Try again; the app's log has the details.";
  public static readonly signInUnread: string = "GitHub's sign-in couldn't be read; the app's log has the details.";
  public static readonly tryAgain: string = "Try again";
  public static readonly openOnGitHub: string = "Open on GitHub";
  public static readonly checksLabel: string = "Checks";
  public static readonly checkLabels: Readonly<Record<CheckState, string>> = {
    [CheckState.Failed]: "Failed",
    [CheckState.Running]: "Running",
    [CheckState.Queued]: "Queued",
    [CheckState.Succeeded]: "Passed",
    [CheckState.Neutral]: "Skipped"
  };
  public static readonly failureTitles: Readonly<Record<SignInFailure, string>> = {
    [SignInFailure.Expired]: "The code expired before it was entered.",
    [SignInFailure.Denied]: "The sign-in was refused on GitHub.",
    [SignInFailure.Revoked]: "GitHub no longer accepts this computer's sign-in.",
    [SignInFailure.Unreachable]: "GitHub couldn't be reached.",
    [SignInFailure.Refused]: "GitHub's answer couldn't be used.",
    [SignInFailure.Unkept]: "This computer couldn't keep the sign-in.",
    [SignInFailure.Unforgotten]: "This computer couldn't remove the sign-in.",
    [SignInFailure.AlreadyKept]: "This GitHub account is already in the list."
  };
  public static readonly failureHints: Readonly<Record<SignInFailure, string>> = {
    [SignInFailure.Expired]: "Sign in again for a new code.",
    [SignInFailure.Denied]: "Sign in again to approve Noldova.",
    [SignInFailure.Revoked]: "Sign in again to restore it.",
    [SignInFailure.Unreachable]: "Check the connection, then sign in again.",
    [SignInFailure.Refused]: "Sign in again; the app's log has the details.",
    [SignInFailure.Unkept]: "Sign in again; the app's log has the details.",
    [SignInFailure.Unforgotten]: "The app may sign in with it when it next starts; the app's log has the details.",
    [SignInFailure.AlreadyKept]: "Sign this entry out, or sign in again as another account."
  };

  public static formatAvatarKey(home: string, email: string): string {
    return `${home} ${email}`;
  }

  public static formatRequestFailed(method: string, reason: string): string {
    return `The GitHub module's ${method} request failed: ${reason}`;
  }

  public static formatEventUnread(event: string, reason: string): string {
    return `The GitHub module's ${event} event couldn't be read: ${reason}`;
  }

  public static formatLinkFailed(url: string, reason: string): string {
    return `The GitHub module couldn't open ${url}: ${reason}`;
  }

  public static formatPullRequestLabel(number: number): string {
    return `#${number}`;
  }

  public static formatRemoteKey(host: string, path: string): string {
    return `${host}/${path}`;
  }

  public static formatPullRequestTitle(number: number, title: string): string {
    return `#${number} ${title}`;
  }

  public static formatHostRowCode(userCode: string, isCopied: boolean): string {
    return isCopied ? Resources.formatPasteCode(userCode) : `Enter ${userCode} on GitHub to sign in.`;
  }

  public static formatCssUrl(value: string): string {
    return `url("${value}")`;
  }

  public static formatLightDark(light: string, dark: string): string {
    return `light-dark(${light}, ${dark})`;
  }

  public static formatLookKey(kind: ReferenceKind, state: ReferenceState): string {
    return `${kind} ${state}`;
  }

  public static formatFill(color: string, percent: number): string {
    return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
  }

  public static formatRepositoryAccount(login: string): string {
    return `Account: ${login}`;
  }

  public static formatRemoteAccount(login: string): string {
    return `Account: ${login}, picked by the remote's address`;
  }

  public static formatAccountDetail(account: HostAccount): string {
    const access: string = Resources.formatAccess(account.scopes);
    return Object.isNull(account.name) ? access : `${account.login} · ${access}`;
  }

  public static formatAccess(scopes: readonly string[]): string {
    return scopes.includes(Resources.repositoryScope) ? Resources.withRepositories : Resources.withoutRepositories;
  }

  public static formatCodeNote(verificationUri: string, userCode: string, isCopied: boolean): string {
    return isCopied ? Resources.formatPasteCode(userCode) : `Enter this code at ${verificationUri.replace(Resources.addressPrefix, "")}.`;
  }

  public static formatPasteCode(userCode: string): string {
    return `Paste the code ${userCode} on GitHub's page; it's copied.`;
  }

  public static formatWaiting(remainingSeconds: number): string {
    const minutes = Math.floor(remainingSeconds / Resources.minuteSeconds);
    const seconds = String(remainingSeconds % Resources.minuteSeconds).padStart(2, "0");
    return `Waiting for GitHub. The code expires in ${minutes}:${seconds}.`;
  }

  public static formatGitHubReferenceLocation(owner: string, repository: string, number: number): string {
    return `${owner}/${repository} #${number}`;
  }

  public static formatGitHubRepositoryAddress(owner: string, repository: string): string {
    return `${Resources.gitHubReferenceProtocol}//${Resources.gitHubHost}/${owner}/${repository}`;
  }

  public static formatGitHubTextAddress(reference: string): string {
    return `${Resources.gitHubReferenceProtocol}//${Resources.gitHubHost}/${reference.replace(Resources.gitHubTextNumberMark, `/${Resources.gitHubIssuesSegment}/`)}`;
  }

  public static formatGitHubPullFilesAddress(owner: string, repository: string, number: number): string {
    return `${Resources.formatGitHubRepositoryAddress(owner, repository)}/${Resources.gitHubPullSegment}/${number}/${Resources.gitHubFilesSegment}`;
  }

  public static formatGitHubNewPullRequestAddress(path: string, source: string, target: string): string {
    const branch = (name: string): string => name.split(Resources.slash).map(t => encodeURIComponent(t)).join(Resources.slash);
    return `${Resources.gitHubReferenceProtocol}//${Resources.gitHubHost}/${path}/${Resources.gitHubCompareSegment}/${branch(target)}...${branch(source)}?expand=1`;
  }

  public static formatGitHubPersonAddress(login: string): string {
    return `${Resources.gitHubReferenceProtocol}//${Resources.gitHubHost}/${encodeURIComponent(login)}`;
  }

  public static formatGitHubAppAddress(name: string): string {
    return `${Resources.gitHubReferenceProtocol}//${Resources.gitHubHost}/${Resources.gitHubAppsSegment}/${encodeURIComponent(name)}`;
  }

  public static formatGitHubReferenceReadFailed(error: string): string {
    return `Reading a GitHub reference failed, so it shows as a plain link: ${error}`;
  }

  public static formatServerDetail(login: string, host: string): string {
    return `${login} · ${host}`;
  }

  public static formatTokenPageUrl(host: string): string {
    return `https://${host}/settings/tokens/new?scopes=${Resources.repositoryScope}&description=${encodeURIComponent(Resources.tokenDescription)}`;
  }

  public static formatTokensUrl(host: string): string {
    return `https://${host}/settings/tokens`;
  }
}
