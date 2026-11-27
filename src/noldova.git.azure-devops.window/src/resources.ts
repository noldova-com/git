/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { CheckState, type HostPerson, type HostWorkItemType, PolicyState, ReferenceState, SignInFailure, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { GitCounts } from "@noldova/git.window";
import type { IconName } from "@noldova/ui.components.angular";

import { WorkItemFacet } from "./app/enums/work-item-facet.ts";
import { MergeTypeChoice } from "./app/models/merge-type-choice.ts";
import { VoteChoice } from "./app/models/vote-choice.ts";

export class Resources {
  public static readonly accountsPage: string = "git.accounts";
  public static readonly openSettingsCommand: string = "desktop.openSettings";
  public static readonly settingsPageArgument: string = "page";
  public static readonly pullRequestsUnanswered: string = "Azure DevOps didn't answer. Try again to read this repository's pull requests.";
  public static readonly branchPullRequestUnanswered: string = "Azure DevOps didn't answer. Its pull request reads again when the window takes the focus.";
  public static readonly commitPullRequestUnanswered: string = "Azure DevOps didn't answer. Its pull request reads again when the commit opens again.";
  public static readonly pullRequestDocument: string = "git-azure-devops.pullRequest";
  public static readonly pullRequestInstancePattern: RegExp = /^(?<owner>[^/]+)\/(?<repository>[^/]+)\/(?<number>[1-9][0-9]{0,9})$/;
  public static readonly ownerGroup: string = "owner";
  public static readonly repositoryGroup: string = "repository";
  public static readonly numberGroup: string = "number";
  public static readonly groupSeparator: string = "\\";
  public static readonly pullRequestUnanswered: string = "Azure DevOps didn't answer. Try again to read this pull request.";
  public static readonly pullRequestMissing: string = "This pull request can't be shown. Sign in to its organization in Settings → Accounts and hosts, or check that it still exists.";
  public static readonly pullRequestReading: string = "Reading the pull request on Azure DevOps.";
  public static readonly pullRequestSignedOut: string = "You signed out of Azure DevOps, so this pull request isn't shown. Sign in to read it again.";
  public static readonly pullRequestTabs: string = "Pull request";
  public static readonly overviewTab: string = "Overview";
  public static readonly filesTab: string = "Files";
  public static readonly updatesTab: string = "Updates";
  public static readonly commitsTab: string = "Commits";
  public static readonly updatesReading: string = "Reading the updates on Azure DevOps.";
  public static readonly filesReading: string = "Reading the files on Azure DevOps.";
  public static readonly updatesUnanswered: string = "Azure DevOps didn't answer. Try again to read the updates.";
  public static readonly noUpdates: string = "No updates.";
  public static readonly updatesCapped: string = "Showing the latest 100.";
  public static readonly moreMark: string = "+";
  public static readonly conflictsTab: string = "Conflicts";
  public static readonly pullRequestPagePattern: RegExp = /\/pullrequest\/\d+$/;
  public static readonly leadingSlashPattern: RegExp = /^\//;
  public static readonly pullRequestPageRepositoryPattern: RegExp = /^https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)\/pullrequest\/\d+$/;
  public static readonly descriptionTitle: string = "Description";
  public static readonly noDescription: string = "No description.";
  public static readonly policiesTitle: string = "Policies";
  public static readonly noPolicies: string = "No branch policies.";
  public static readonly writeUnanswered: string = "Azure DevOps didn't answer, so nothing changed. Try again.";
  public static readonly reviewersTitle: string = "Reviewers";
  public static readonly noReviewers: string = "No reviewers.";
  public static readonly addReviewerLabel: string = "Add reviewer";
  public static readonly addReviewerIcon: IconName = "person_add";
  public static readonly searchIcon: IconName = "search";
  public static readonly reviewerSearchLabel: string = "Find a person or group to add as a reviewer";
  public static readonly reviewerSearchPlaceholder: string = "Name or email";
  public static readonly reviewerResultsLabel: string = "People and groups found";
  public static readonly noPeopleFound: string = "No one matches.";
  public static readonly groupIcon: IconName = "groups";
  public static readonly groupLabel: string = "Group";
  public static readonly searchUnanswered: string = "Azure DevOps didn't answer. Type again to search.";
  public static readonly minimumPeopleQuery: number = 3;
  public static readonly workItemsTitle: string = "Work items";
  public static readonly noWorkItems: string = "No linked work items.";
  public static readonly buildsTitle: string = "Builds";
  public static readonly noBuilds: string = "No builds.";
  public static readonly required: string = "Required";
  public static readonly optional: string = "Optional";
  public static readonly running: string = "running";
  public static readonly noVoteYet: string = "No vote yet";
  public static readonly groupStart: string = "[";
  public static readonly groupEnd: string = "]";
  public static readonly into: string = "into";
  public static readonly autoComplete: string = "Completes by itself once its policies pass";
  public static readonly autoCompleteIcon: IconName = "schedule";
  public static readonly unknownAuthor: string = "Someone";
  public static readonly approvedVoteIcon: IconName = "check";
  public static readonly waitingVoteIcon: IconName = "schedule";
  public static readonly rejectedVoteIcon: IconName = "close";
  public static readonly openDateFormat: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  public static readonly accountId: string = "git-azure-devops.account";
  public static readonly hostName: string = "Azure DevOps";
  public static readonly hostColumn: string = "Azure";
  public static readonly hostMark: string = "Az";
  public static readonly hostColor: string = "#0067b8";
  public static readonly signedInChip: string = "Signed in";
  public static readonly waiting: string = "Waiting for the browser";
  public static readonly signInAction: string = "Sign in";
  public static readonly accountTitle: string = "Account";
  public static readonly signedOutNote: string = "Sign in to see pull requests, their checks and their reviewers' votes. Git works without it.";
  public static readonly signIn: string = "Sign in";
  public static readonly signInIcon: IconName = "login";
  public static readonly signInWithMicrosoft: string = "Sign in with Microsoft";
  public static readonly microsoftNote: string = "Your organization's admin may need to approve this app.";
  public static readonly microsoftTitle: string = "Or sign in with Microsoft";
  public static readonly browserNote: string = "Finish signing in with Microsoft in the browser; this page updates once you're done.";
  public static readonly openBrowserAgain: string = "Open the sign-in again";
  public static readonly waitingForMicrosoft: string = "Waiting for Microsoft.";
  public static readonly cancel: string = "Cancel";
  public static readonly tokenLabel: string = "Personal access token";
  public static readonly tokenPlaceholder: string = "Paste a personal access token";
  public static readonly organizationLabel: string = "Organization";
  public static readonly organizationPlaceholder: string = "Organization, as in dev.azure.com/organization";
  public static readonly organizationUnread: string = "Type the organization's name, or paste its address on dev.azure.com or visualstudio.com.";
  public static readonly tokenNote: string = "Make the token in this organization with these scopes. It's kept in this computer's secrets.";
  public static readonly tokenScopesLabel: string = "Token scopes";
  public static readonly tokenScopes: readonly string[] = ["Code (Read & write)", "Work Items (Read & write)", "Graph (Read)", "Build (Read)"];
  public static readonly makeToken: string = "Make a token on Azure DevOps";
  public static readonly openIcon: IconName = "open_in_new";
  public static readonly signOut: string = "Sign out";
  public static readonly signOutIcon: IconName = "logout";
  public static readonly failureIcon: IconName = "error";
  public static readonly signedIn: string = "Signed in on this computer";
  public static readonly signInUnanswered: string = "Azure DevOps' sign-in didn't answer.";
  public static readonly linkNotOpened: string = "The page couldn't be opened.";
  public static readonly requestFailedHint: string = "Try again; the app's log has the details.";
  public static readonly signInUnread: string = "Azure DevOps' sign-in couldn't be read; the app's log has the details.";
  public static readonly tryAgain: string = "Try again";
  public static readonly azureHost: string = "dev.azure.com";
  public static readonly azureSshHost: string = "ssh.dev.azure.com";
  public static readonly visualStudioSshHost: string = "vs-ssh.visualstudio.com";
  public static readonly visualStudioSuffix: string = ".visualstudio.com";
  public static readonly remotePathSeparator: string = "/";
  public static readonly unescapedPattern: RegExp = /[!'()*~]/gu;
  public static readonly hostRowSignedOut: string = "Sign in in Settings → Accounts and hosts to see this branch's pull request and its checks.";
  public static readonly readingPullRequest: string = "Reading this branch's pull request on Azure DevOps.";
  public static readonly noPullRequest: string = "No pull request for this branch";
  public static readonly unanswered: string = "Azure DevOps didn't answer. Try again to read this branch's pull request.";
  public static readonly hostRowSignInUnanswered: string = "Azure DevOps' sign-in didn't answer. Try again.";
  public static readonly hostRowLinkNotOpened: string = "The page couldn't be opened; the app's log has the details.";
  public static readonly openAgain: string = "Open the page again";
  public static readonly openOnAzureDevOps: string = "Open in Azure DevOps";
  public static readonly autoCompleteVoteConfirm: string = "This pull request completes by itself once its policies pass, so this approval may merge it at once.";
  public static readonly approveAnyway: string = "Approve anyway";
  public static readonly cancelAction: string = "Cancel";
  public static readonly voteMenuLabel: string = "Your vote";
  public static readonly voteChoices: readonly VoteChoice[] = [new VoteChoice(10, "Approve"), new VoteChoice(5, "Approve with suggestions"),
    new VoteChoice(-5, "Wait for author"), new VoteChoice(-10, "Reject")];
  public static readonly resetVote: VoteChoice = new VoteChoice(0, "Reset vote");
  public static readonly approveVote: number = 10;
  public static readonly approveAction: string = "Approve";
  public static readonly approveIcon: IconName = "check";
  public static readonly moreVotesLabel: string = "More votes";
  public static readonly moreVotesIcon: IconName = "keyboard_arrow_down";
  public static readonly votesGoAsYou: string = "Votes and comments go to Azure DevOps as you.";
  public static readonly ownVoteNone: string = "none yet";
  public static readonly completeTitle: string = "Complete";
  public static readonly completeLabel: string = "Complete the pull request";
  public static readonly mergeTypeTitle: string = "Merge type";
  public static readonly mergeTypeChoices: readonly MergeTypeChoice[] = [new MergeTypeChoice("noFastForward", "Merge, no fast-forward"),
    new MergeTypeChoice("squash", "Squash commit"), new MergeTypeChoice("rebase", "Rebase and fast-forward"), new MergeTypeChoice("rebaseMerge", "Semi-linear merge")];
  public static readonly fastForwardMergeType: string = "rebase";
  public static readonly squashMergeType: string = "squash";
  public static readonly notAllowedByPolicy: string = "Not allowed by the branch policy";
  public static readonly mergeTypesReading: string = "Reading the merge types the branch allows.";
  public static readonly mergeTypesUnanswered: string = "Azure DevOps didn't say which merge types the branch allows. Try again.";
  public static readonly commitMessageTitle: string = "Commit message";
  public static readonly maximumMergeMessageLength: number = 4000;
  public static readonly completeWorkItemsLabel: string = "Complete linked work items after merging";
  public static readonly blockingIcon: IconName = "error";
  public static readonly completeMergeAction: string = "Complete merge";
  public static readonly setAutoCompleteAction: string = "Set auto-complete";
  public static readonly cancelAutoCompleteAction: string = "Cancel auto-complete";
  public static readonly keepAutoCompleteAction: string = "Keep auto-complete";
  public static readonly abandonAction: string = "Abandon";
  public static readonly autoCompleteThen: string = "Auto-complete then merges it without you.";
  public static readonly checksLabel: string = "Checks";
  public static readonly ariaTrue: string = "true";
  public static readonly signedOutIcon: IconName = "key";
  public static readonly noPullRequestIcon: IconName = "merge";
  public static readonly referenceProtocol: string = "https:";
  public static readonly webProtocols: readonly string[] = ["https:", "http:"];
  public static readonly schemeMark: string = "://";
  public static readonly slash: string = "/";
  public static readonly defaultCollection: string = "defaultcollection";
  public static readonly organizationPattern: RegExp = /^[A-Za-z0-9][A-Za-z0-9-]{0,49}$/;
  public static readonly remoteWebPathPattern: RegExp = /^([^/]+)\/[^/]+\/_git\/[^/]+$/;
  public static readonly remoteSshPathPattern: RegExp = /^v3\/([^/]+)\/[^/]+\/[^/]+$/;
  public static readonly remoteCollectionPathPattern: RegExp = /^(?:DefaultCollection\/)?[^/]+\/_git\/[^/]+$/;
  public static readonly pageProjectPattern: RegExp = /^([^/_][^/]*)\/./;
  public static readonly workItemPathPattern: RegExp = /^(?:([^/]+)\/)?_workitems\/edit\/([1-9][0-9]{0,9})$/;
  public static readonly pullRequestPathPattern: RegExp =
    /^[^/]+\/_git\/([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})\/pullrequest\/([1-9][0-9]{0,9})$/;
  public static readonly textReferencePattern: RegExp = /(?<![\w./#&-])(?:AB)?#[1-9][0-9]{0,9}(?![\w-])/gu;
  public static readonly textNumberMark: string = "#";
  public static readonly iterationSeparator: string = "\\";
  public static readonly referenceReadLimit: number = 4;
  public static readonly referenceMemoryLimit: number = 500;
  public static readonly workItemLabel: string = "Work item";
  public static readonly pullRequestLabel: string = "Pull request";
  public static readonly fillPercent: number = 16;
  public static readonly svgImagePrefix: string = "data:image/svg+xml,";
  public static readonly categoryTones: Readonly<Record<WorkItemCategory, string>> = {
    [WorkItemCategory.Proposed]: "#B2B2B2",
    [WorkItemCategory.InProgress]: "#007ACC",
    [WorkItemCategory.Resolved]: "#FF9D00",
    [WorkItemCategory.Completed]: "#339933",
    [WorkItemCategory.Removed]: "var(--nol-text-muted)"
  };
  public static readonly bookSymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h480q33 0 56.5 23.5T800-800v640q0 33-23.5 56.5T720-80H240Zm0-80h480v-640h-80v245q0 12-10 17.5t-20-.5l-49-30q-10-6-20.5-6t-20.5 6l-49 30q-10 6-20.5.5T440-555v-245H240v640Zm0 0v-640 640Zm200-395q0 12 10.5 17.5t20.5-.5l49-30q10-6 20.5-6t20.5 6l49 30q10 6 20 .5t10-17.5q0 12-10 17.5t-20-.5l-49-30q-10-6-20.5-6t-20.5 6l-49 30q-10 6-20.5.5T440-555Z"/></svg>';
  public static readonly bugReportSymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="M480-120q-65 0-120.5-32T272-240h-72q-17 0-28.5-11.5T160-280q0-17 11.5-28.5T200-320h44q-3-20-3.5-40t-.5-40h-40q-17 0-28.5-11.5T160-440q0-17 11.5-28.5T200-480h40q0-20 .5-40t3.5-40h-44q-17 0-28.5-11.5T160-600q0-17 11.5-28.5T200-640h72q14-23 31.5-43t40.5-35l-37-38q-11-11-11-27.5t12-28.5q11-11 28-11t28 11l58 58q28-9 57-9t57 9l60-59q11-11 27.5-11t28.5 12q11 11 11 28t-11 28l-38 38q23 15 41.5 34.5T688-640h72q17 0 28.5 11.5T800-600q0 17-11.5 28.5T760-560h-44q3 20 3.5 40t.5 40h40q17 0 28.5 11.5T800-440q0 17-11.5 28.5T760-400h-40q0 20-.5 40t-3.5 40h44q17 0 28.5 11.5T800-280q0 17-11.5 28.5T760-240h-72q-32 56-87.5 88T480-120Zm0-80q66 0 113-47t47-113v-160q0-66-47-113t-113-47q-66 0-113 47t-47 113v160q0 66 47 113t113 47Zm-40-120h80q17 0 28.5-11.5T560-360q0-17-11.5-28.5T520-400h-80q-17 0-28.5 11.5T400-360q0 17 11.5 28.5T440-320Zm0-160h80q17 0 28.5-11.5T560-520q0-17-11.5-28.5T520-560h-80q-17 0-28.5 11.5T400-520q0 17 11.5 28.5T440-480Zm40 40Z"/></svg>';
  public static readonly assignmentSymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h168q13-36 43.5-58t68.5-22q38 0 68.5 22t43.5 58h168q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm120-80h200q17 0 28.5-11.5T560-320q0-17-11.5-28.5T520-360H320q-17 0-28.5 11.5T280-320q0 17 11.5 28.5T320-280Zm0-160h320q17 0 28.5-11.5T680-480q0-17-11.5-28.5T640-520H320q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440Zm0-160h320q17 0 28.5-11.5T680-640q0-17-11.5-28.5T640-680H320q-17 0-28.5 11.5T280-640q0 17 11.5 28.5T320-600Zm160-190q13 0 21.5-8.5T510-820q0-13-8.5-21.5T480-850q-13 0-21.5 8.5T450-820q0 13 8.5 21.5T480-790ZM200-200v-560 560Z"/></svg>';
  public static readonly crownSymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="M240-160q-17 0-28.5-11.5T200-200q0-17 11.5-28.5T240-240h480q17 0 28.5 11.5T760-200q0 17-11.5 28.5T720-160H240Zm28-140q-29 0-51.5-19T189-367l-40-254q-2 0-4.5.5t-4.5.5q-25 0-42.5-17.5T80-680q0-25 17.5-42.5T140-740q25 0 42.5 17.5T200-680q0 7-1.5 13t-3.5 11l125 56 125-171q-11-8-18-21t-7-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820q0 15-7 28t-18 21l125 171 125-56q-2-5-3.5-11t-1.5-13q0-25 17.5-42.5T820-740q25 0 42.5 17.5T880-680q0 25-17.5 42.5T820-620q-2 0-4.5-.5t-4.5-.5l-40 254q-5 29-27.5 48T692-300H268Zm0-80h424l26-167-46 20q-26 11-53 4t-44-30l-95-131-95 131q-17 23-44 30t-53-4l-46-20 26 167Zm212 0Z"/></svg>';
  public static readonly trophySymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="M440-200v-124q-49-11-87.5-41.5T296-442q-75-9-125.5-65.5T120-640v-40q0-33 23.5-56.5T200-760h80q0-33 23.5-56.5T360-840h240q33 0 56.5 23.5T680-760h80q33 0 56.5 23.5T840-680v40q0 76-50.5 132.5T664-442q-18 46-56.5 76.5T520-324v124h120q17 0 28.5 11.5T680-160q0 17-11.5 28.5T640-120H320q-17 0-28.5-11.5T280-160q0-17 11.5-28.5T320-200h120ZM280-528v-152h-80v40q0 38 22 68.5t58 43.5Zm200 128q50 0 85-35t35-85v-240H360v240q0 50 35 85t85 35Zm200-128q36-13 58-43.5t22-68.5v-40h-80v152Zm-200-52Z"/></svg>';
  public static readonly listSymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="M320-600q-17 0-28.5-11.5T280-640q0-17 11.5-28.5T320-680h480q17 0 28.5 11.5T840-640q0 17-11.5 28.5T800-600H320Zm0 160q-17 0-28.5-11.5T280-480q0-17 11.5-28.5T320-520h480q17 0 28.5 11.5T840-480q0 17-11.5 28.5T800-440H320Zm0 160q-17 0-28.5-11.5T280-320q0-17 11.5-28.5T320-360h480q17 0 28.5 11.5T840-320q0 17-11.5 28.5T800-280H320ZM160-600q-17 0-28.5-11.5T120-640q0-17 11.5-28.5T160-680q17 0 28.5 11.5T200-640q0 17-11.5 28.5T160-600Zm0 160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520q17 0 28.5 11.5T200-480q0 17-11.5 28.5T160-440Zm0 160q-17 0-28.5-11.5T120-320q0-17 11.5-28.5T160-360q17 0 28.5 11.5T200-320q0 17-11.5 28.5T160-280Z"/></svg>';
  public static readonly checkBoxSymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="m424-424-86-86q-11-11-28-11t-28 11q-11 11-11 28t11 28l114 114q12 12 28 12t28-12l226-226q11-11 11-28t-11-28q-11-11-28-11t-28 11L424-424ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/></svg>';
  public static readonly descriptionSymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="M360-240h240q17 0 28.5-11.5T640-280q0-17-11.5-28.5T600-320H360q-17 0-28.5 11.5T320-280q0 17 11.5 28.5T360-240Zm0-160h240q17 0 28.5-11.5T640-440q0-17-11.5-28.5T600-480H360q-17 0-28.5 11.5T320-440q0 17 11.5 28.5T360-400ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h287q16 0 30.5 6t25.5 17l194 194q11 11 17 25.5t6 30.5v447q0 33-23.5 56.5T720-80H240Zm280-560v-160H240v640h480v-440H560q-17 0-28.5-11.5T520-640ZM240-800v200-200 640-640Z"/></svg>';
  public static readonly mergeSymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="M480-344 284-148q-11 11-27.5 11.5T228-148q-11-11-11-28t11-28l165-166q23-23 35-52t12-61v-204l-36 36q-11 11-27.5 11T348-652q-11-11-11-28t11-28l104-104q12-12 28-12t28 12l104 104q11 11 11.5 27.5T612-652q-11 11-28 11t-28-11l-36-35v204q0 32 12 61t35 52l165 166q11 11 11.5 27.5T732-148q-11 11-28 11t-28-11L480-344Z"/></svg>';
  public static readonly draftSymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h287q16 0 30.5 6t25.5 17l194 194q11 11 17 25.5t6 30.5v447q0 33-23.5 56.5T720-80H240Zm280-560v-160H240v640h480v-440H560q-17 0-28.5-11.5T520-640ZM240-800v200-200 640-640Z"/></svg>';
  public static readonly checkCircleSymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="m424-408-86-86q-11-11-28-11t-28 11q-11 11-11 28t11 28l114 114q12 12 28 12t28-12l226-226q11-11 11-28t-11-28q-11-11-28-11t-28 11L424-408Zm56 328q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>';
  public static readonly blockSymbol: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z"/></svg>';
  public static readonly workItemSymbols: ReadonlyMap<string, string> = new Map([
    ["icon_book", Resources.bookSymbol],
    ["icon_insect", Resources.bugReportSymbol],
    ["icon_clipboard", Resources.assignmentSymbol],
    ["icon_crown", Resources.crownSymbol],
    ["icon_trophy", Resources.trophySymbol],
    ["icon_list", Resources.listSymbol],
    ["icon_check_box", Resources.checkBoxSymbol]
  ]);
  public static readonly pullRequestSymbols: Readonly<Record<ReferenceState, string>> = {
    [ReferenceState.Open]: Resources.mergeSymbol,
    [ReferenceState.Draft]: Resources.draftSymbol,
    [ReferenceState.Merged]: Resources.checkCircleSymbol,
    [ReferenceState.Closed]: Resources.blockSymbol,
    [ReferenceState.ClosedDone]: Resources.blockSymbol,
    [ReferenceState.ClosedNotPlanned]: Resources.blockSymbol
  };
  public static readonly stateLabels: Readonly<Record<ReferenceState, string>> = {
    [ReferenceState.Open]: "Active",
    [ReferenceState.Draft]: "Draft",
    [ReferenceState.Merged]: "Completed",
    [ReferenceState.Closed]: "Abandoned",
    [ReferenceState.ClosedDone]: "Abandoned",
    [ReferenceState.ClosedNotPlanned]: "Abandoned"
  };
  public static readonly stateIcons: Readonly<Record<ReferenceState, IconName>> = {
    [ReferenceState.Open]: "merge",
    [ReferenceState.Draft]: "draft",
    [ReferenceState.Merged]: "check_circle",
    [ReferenceState.Closed]: "block",
    [ReferenceState.ClosedDone]: "block",
    [ReferenceState.ClosedNotPlanned]: "block"
  };
  public static readonly pullRequestStateIcons: Readonly<Record<ReferenceState, IconName>> = { ...Resources.stateIcons, [ReferenceState.Open]: "radio_button_checked" };
  public static readonly stateColors: Readonly<Record<ReferenceState, string>> = {
    [ReferenceState.Open]: "var(--nol-status-ok)",
    [ReferenceState.Draft]: "var(--nol-text-muted)",
    [ReferenceState.Merged]: "var(--nol-accent)",
    [ReferenceState.Closed]: "var(--nol-text-muted)",
    [ReferenceState.ClosedDone]: "var(--nol-text-muted)",
    [ReferenceState.ClosedNotPlanned]: "var(--nol-text-muted)"
  };
  public static readonly checkLabels: Readonly<Record<CheckState, string>> = {
    [CheckState.Failed]: "Failed",
    [CheckState.Running]: "Running",
    [CheckState.Queued]: "Queued",
    [CheckState.Succeeded]: "Passed",
    [CheckState.Neutral]: "Neutral"
  };
  public static readonly checkIcons: Readonly<Record<CheckState, IconName>> = {
    [CheckState.Failed]: "cancel",
    [CheckState.Running]: "progress_activity",
    [CheckState.Queued]: "schedule",
    [CheckState.Succeeded]: "check_circle",
    [CheckState.Neutral]: "do_not_disturb_on"
  };
  public static readonly failureTitles: Readonly<Record<SignInFailure, string>> = {
    [SignInFailure.Expired]: "The sign-in expired.",
    [SignInFailure.Denied]: "The sign-in was refused.",
    [SignInFailure.Revoked]: "Azure DevOps no longer accepts the sign-in.",
    [SignInFailure.Unreachable]: "Azure DevOps couldn't be reached.",
    [SignInFailure.Refused]: "Azure DevOps didn't accept the sign-in.",
    [SignInFailure.Unkept]: "This computer couldn't keep the sign-in.",
    [SignInFailure.Unforgotten]: "This computer couldn't remove the sign-in.",
    [SignInFailure.AlreadyKept]: "This account is already signed in."
  };
  public static readonly failureHints: Readonly<Record<SignInFailure, string>> = {
    [SignInFailure.Expired]: "Sign in again.",
    [SignInFailure.Denied]: "Sign in again, and accept what the sign-in asks to read and write.",
    [SignInFailure.Revoked]: "The sign-in or its token expired or was revoked; sign in again.",
    [SignInFailure.Unreachable]: "Check the connection, then sign in again.",
    [SignInFailure.Refused]: "Check that the account belongs to this organization, or that the token was copied whole and hasn't expired, then sign in again.",
    [SignInFailure.Unkept]: "Sign in again; the app's log has the details.",
    [SignInFailure.Unforgotten]: "The app may sign in with it when it next starts; the app's log has the details.",
    [SignInFailure.AlreadyKept]: "Sign this entry out, or sign in again as another account."
  };

  public static formatYourVote(label: string): string {
    return `Your vote: ${label}. ${Resources.votesGoAsYou}`;
  }

  public static formatSquashNote(branch: string): string {
    return `One commit on ${branch}, history kept in the PR`;
  }

  public static formatMergeMessage(number: number, title: string, workItems: readonly number[]): string {
    const merged: string = `Merged PR ${String(number)}: ${title}`;
    return workItems.length === 0 ? merged : `${merged}\n\nRelated work items: ${workItems.map(t => `#${String(t)}`).join(", ")}`;
  }

  public static formatDeleteBranch(branch: string): string {
    return `Delete ${branch}`;
  }

  public static formatBlockingPolicies(count: number): string {
    return count === 1 ? "1 policy blocks completion" : `${String(count)} policies block completion`;
  }

  public static formatCompleteConfirm(number: number, mergeType: string, branch: string, deletedBranch: string | null, workItems: number): string {
    return `Complete !${String(number)} with ${mergeType} into ${branch}${Resources.thenOf(deletedBranch, workItems)}? This merges it in Azure DevOps as you.`;
  }

  public static formatAutoCompleteConfirm(number: number, mergeType: string, branch: string, deletedBranch: string | null, workItems: number): string {
    return `Set !${String(number)} to complete by itself with ${mergeType} into ${branch} once its policies pass${Resources.thenOf(deletedBranch, workItems)}? `
      + "Azure DevOps then merges it as you, without asking again.";
  }

  public static formatCancelAutoCompleteConfirm(number: number): string {
    return `Stop !${String(number)} from completing by itself? It stays open until someone completes it.`;
  }

  public static formatAbandonConfirm(number: number): string {
    return `Abandon !${String(number)}? It closes without merging; Azure DevOps can reactivate it.`;
  }

  public static formatPullAfter(branch: string): string {
    return `Pull ${branch} here after the merge`;
  }

  public static formatRemoteBranch(remote: string, branch: string): string {
    return `${remote}/${branch}`;
  }

  public static formatPulled(branch: string): string {
    return `Pulled ${branch} here.`;
  }

  public static formatPullNotMerged(branch: string): string {
    return `Azure DevOps hasn't merged it yet, so ${branch} wasn't pulled here.`;
  }

  public static formatPullMoved(branch: string): string {
    return `The folder isn't on ${branch} any more, so it wasn't pulled.`;
  }

  public static formatPullFolderChanged(branch: string): string {
    return `The open folder changed since Complete merge, so ${branch} wasn't pulled.`;
  }

  public static formatPullUnanswered(branch: string): string {
    return `Git didn't answer, so ${branch} may not be pulled here.`;
  }

  public static formatRequestFailed(method: string, reason: string): string {
    return `The Azure DevOps module's ${method} request failed: ${reason}`;
  }

  public static formatEventUnread(event: string, reason: string): string {
    return `The Azure DevOps module's ${event} event couldn't be read: ${reason}`;
  }

  public static formatTokensUrl(organization: string, isVisualStudio: boolean): string {
    return isVisualStudio ? `https://${organization}.visualstudio.com/_usersSettings/tokens` : `https://dev.azure.com/${organization}/_usersSettings/tokens`;
  }

  public static formatLinkFailed(url: string, reason: string): string {
    return `The Azure DevOps module couldn't open ${url}: ${reason}`;
  }

  public static readonly policyLabels: Readonly<Record<PolicyState, string>> = {
    [PolicyState.Queued]: "Queued",
    [PolicyState.Running]: "Running",
    [PolicyState.Approved]: "Passed",
    [PolicyState.Rejected]: "Failed",
    [PolicyState.NotApplicable]: "Doesn't apply"
  };
  public static readonly policyIcons: Readonly<Record<PolicyState, IconName>> = {
    [PolicyState.Queued]: "schedule",
    [PolicyState.Running]: "progress_activity",
    [PolicyState.Approved]: "check_circle",
    [PolicyState.Rejected]: "error",
    [PolicyState.NotApplicable]: "do_not_disturb_on"
  };
  public static readonly policyColors: Readonly<Record<PolicyState, string>> = {
    [PolicyState.Queued]: "var(--nol-text-muted)",
    [PolicyState.Running]: "var(--nol-text-muted)",
    [PolicyState.Approved]: "var(--nol-status-ok)",
    [PolicyState.Rejected]: "var(--nol-status-failed)",
    [PolicyState.NotApplicable]: "var(--nol-text-muted)"
  };
  public static readonly checkColors: Readonly<Record<CheckState, string>> = {
    [CheckState.Failed]: "var(--nol-status-failed)",
    [CheckState.Running]: "var(--nol-text-muted)",
    [CheckState.Queued]: "var(--nol-text-muted)",
    [CheckState.Succeeded]: "var(--nol-status-ok)",
    [CheckState.Neutral]: "var(--nol-text-muted)"
  };

  public static readonly workItemIcons: ReadonlyMap<string, IconName> = new Map<string, IconName>([
    ["icon_book", "menu_book"],
    ["icon_insect", "bug_report"],
    ["icon_clipboard", "assignment"],
    ["icon_crown", "workspace_premium"],
    ["icon_trophy", "trophy"],
    ["icon_list", "list"],
    ["icon_check_box", "check_box"]
  ]);
  public static readonly workItemFallbackIcon: IconName = "description";

  public static workItemIconOf(icon: string): string {
    return Resources.workItemIcons.get(icon) ?? Resources.workItemFallbackIcon;
  }

  public static workItemImageOf(type: HostWorkItemType): string | null {
    return Object.isNull(type.image) ? null : Resources.svgImagePrefix + encodeURIComponent(type.image);
  }

  public static readonly expandIcon: IconName = "keyboard_arrow_down";
  public static readonly collapsedIcon: IconName = "chevron_right";

  public static formatExpand(isCollapsed: boolean, title: string): string {
    return `${isCollapsed ? "Expand" : "Collapse"} ${title}`;
  }

  public static formatPullRequestInstance(organization: string, repository: string, number: number): string {
    return `${organization}/${repository}/${number}`;
  }

  public static formatCommitPage(pullRequestUrl: string, commitId: string): string {
    return pullRequestUrl.replace(Resources.pullRequestPagePattern, `/commit/${commitId}`);
  }

  public static formatThreadPage(pullRequestUrl: string, path: string, threadId: number): string {
    return `${pullRequestUrl}?_a=files&path=${encodeURIComponent(path)}&discussionId=${threadId}`;
  }

  public static formatUpdateTitle(number: number): string {
    return `Update ${number}`;
  }

  public static formatShowUpdate(number: number): string {
    return `Show update ${number} in the history`;
  }

  public static formatWantsToMerge(author: string): string {
    return `${author} wants to merge`;
  }

  public static formatAvatarName(login: string): string {
    return login.slice(login.lastIndexOf(Resources.groupSeparator) + 1);
  }

  public static formatPersonName(person: HostPerson): string {
    return person.name ?? Resources.formatAvatarName(person.login);
  }

  public static formatCommitCount(count: number): string {
    return count === 1 ? "1 commit" : `${count} commits`;
  }

  public static formatOpened(date: string): string {
    return `opened ${date}`;
  }

  public static formatAutoComplete(mergeType: string | null): string {
    const label: string | undefined = Resources.mergeTypeChoices.find(t => t.type === mergeType)?.label;
    return Object.isUndefined(label) ? Resources.autoComplete : `Auto-complete set: ${label.toLowerCase()} when policies pass`;
  }

  public static formatPolicyRequirement(isBlocking: boolean, isRunning: boolean): string {
    const requirement: string = isBlocking ? Resources.required : Resources.optional;
    return isRunning ? `${requirement} · ${Resources.running}` : requirement;
  }

  public static formatBuildNumber(number: string): string {
    return `#${number}`;
  }

  public static formatPoliciesSummary(passed: number, required: number, branch: string): string {
    return `${passed} of ${required} required passed · branch ${branch}`;
  }

  public static formatReviewerNote(vote: number, label: string, isRequired: boolean): string {
    if (vote !== 0)
      return label;
    return isRequired ? Resources.noVoteYet : `${Resources.noVoteYet} · ${Resources.optional.toLowerCase()}`;
  }

  public static isGroupLogin(login: string): boolean {
    return login.startsWith(Resources.groupStart) && login.includes(Resources.groupEnd + Resources.groupSeparator);
  }

  public static formatBuildTime(minutes: number, seconds: number, isRunning: boolean): string {
    return isRunning ? `${minutes} min ${seconds} s so far` : `${minutes} min ${seconds} s`;
  }

  public static formatPullRequestTitle(number: number, title: string): string {
    return `!${number} ${title}`;
  }

  public static formatAccountTitle(login: string): string {
    return `${Resources.hostName} · ${login}`;
  }

  public static formatAccountNote(login: string): string {
    return `${Resources.signedIn} as ${login}`;
  }

  public static formatSignedIn(name: string | null): string {
    return Object.isNull(name) ? Resources.signedIn : `${name} · signed in on this computer`;
  }

  public static formatWorkItemReference(type: string, id: number): string {
    return `${type} ${id}`;
  }

  public static formatRemoteKey(host: string, path: string): string {
    return `${host}/${path}`;
  }

  public static formatDocumentTitle(label: string, title: string): string {
    return `${label} ${title}`;
  }

  public static formatPullRequestReference(number: number): string {
    return `!${number}`;
  }

  public static formatOpenPullRequest(reference: string): string {
    return `Open pull request ${reference}`;
  }

  public static formatWorkItemKey(organization: string, id: number): string {
    return `${organization}#${id}`.toLowerCase();
  }

  public static formatPullRequestKey(organization: string, repository: string, number: number): string {
    return `${organization}/${repository}!${number}`.toLowerCase();
  }

  public static formatWorkItemAddress(organization: string, id: number): string {
    return `${Resources.formatOrganizationAddress(organization)}/_workitems/edit/${id}`;
  }

  public static formatPullRequestFilesAddress(page: string): string {
    return `${page}?_a=files`;
  }

  public static formatOrganizationAddress(organization: string): string {
    return `${Resources.referenceProtocol}//${Resources.azureHost}/${organization}`;
  }

  public static formatProjectAddress(organization: string, project: string): string {
    return `${Resources.formatOrganizationAddress(organization)}/${encodeURIComponent(project)}`;
  }

  public static formatNewPullRequestAddress(organization: string, project: string, repository: string, source: string, target: string): string {
    return `${Resources.formatProjectAddress(organization, project)}/_git/${encodeURIComponent(repository)}/pullrequestcreate`
      + `?sourceRef=${encodeURIComponent(source)}&targetRef=${encodeURIComponent(target)}`;
  }

  public static formatProjectLocation(organization: string, project: string): string {
    return `${organization}/${project}`;
  }

  public static formatPullRequestLocation(organization: string, number: number): string {
    return `${organization} !${number}`;
  }

  public static formatHexColor(color: string): string {
    return `#${color}`;
  }

  public static formatFill(color: string, percent: number): string {
    return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
  }

  public static readonly branchScheme: string = "git-azure-devops:";
  public static readonly branchAction: string = "branch";
  public static readonly branchOrganizationParameter: string = "organization";
  public static readonly branchIdParameter: string = "id";
  public static readonly branchTitleParameter: string = "title";
  public static readonly branchActionLabel: string = "Create a branch";
  public static readonly branchActionGlyph: IconName = "call_split";
  public static readonly branchNameLabel: string = "Name";
  public static readonly createBranch: string = "Create and switch";
  public static readonly newBranch: string = "Create branch";
  public static readonly statusNotRead: string = "The repository couldn't be read; the app's log has the details.";
  public static readonly shortCommitLength: number = 7;
  public static readonly branchNameSelector: string = ".nol-git-azure-devops-branch-field input";
  public static readonly requestInput: string = "request";
  public static readonly contextInput: string = "context";
  public static readonly branchNotCreated: string = "The branch couldn't be created; the app's log has the details.";
  public static readonly branchNotLinked: string = "The branch couldn't be linked; the app's log has the details.";
  public static readonly branchSlugPattern: RegExp = /[^a-z0-9]+/g;
  public static readonly branchSlugEdges: RegExp = /^-+|-+$/g;
  public static readonly branchSlugLength: number = 50;
  public static readonly dash: string = "-";
  public static readonly basedOnLabel: string = "Based on";
  public static readonly branchPatternNote: string = "From the pattern users/{you}/{id}-{title}";
  public static readonly currentBranchNote: string = "The current branch";
  public static readonly branchOwnerPrefix: string = "users";
  public static readonly loginDomainPattern: RegExp = /@.*$/s;
  public static readonly activeState: string = "Active";
  public static readonly titleSeparator: string = " · ";
  public static readonly branchNotSwitched: string = "It couldn't be checked out; the app's log has the details.";
  public static readonly baseNotFound: string = "The branch to start from has no commit this dialog read; choose another branch.";
  public static readonly branchNotPushed: string = "The branch couldn't be pushed; the app's log has the details.";
  public static readonly pushChoice: string = "Push and track it on origin";
  public static readonly workItemNotUpdated: string = "The work item couldn't be updated; the app's log has the details.";

  public static formatLinkChoice(id: number): string {
    return `Link the branch to ${id} in Azure Boards`;
  }

  public static formatActivateChoice(id: number): string {
    return `Set ${id} to Active and assign it to me`;
  }

  public static formatPrefixChoice(id: number): string {
    return `Start commit messages with ${Resources.formatCommitPrefix(id).trim()}`;
  }

  public static formatCommitPrefix(id: number): string {
    return `#${id} `;
  }

  public static readonly commitPrefixesKey: string = "git-azure-devops.commitPrefixes";
  public static readonly choiceFolderField: string = "folder";
  public static readonly choiceBranchField: string = "branch";
  public static readonly choiceIdField: string = "id";
  public static readonly changesField: string = "changes";
  public static readonly emptyList: string = "[]";

  public static formatOwnedBranch(owner: string, name: string): string {
    return `${Resources.branchOwnerPrefix}${Resources.slash}${owner}${Resources.slash}${name}`;
  }

  public static formatParentBranchNote(type: string): string {
    return `The parent ${type.toLowerCase()}'s branch`;
  }

  public static formatBranchItemLine(title: string, type: string, parent: number | null): string {
    const kind = type.toLowerCase();
    return Object.isNull(parent) ? `${title}${Resources.titleSeparator}${kind}` : `${title}${Resources.titleSeparator}${kind} under ${parent}`;
  }

  public static formatBranchKept(branch: string, isSwitched: boolean, failure: string): string {
    return isSwitched ? `${branch} is created and checked out. ${failure}` : `${branch} is created. ${failure}`;
  }

  public static formatBranchActionAddress(organization: string, id: number, title: string): string {
    const query = new URLSearchParams([[Resources.branchOrganizationParameter, organization], [Resources.branchIdParameter, String(id)],
      [Resources.branchTitleParameter, title]]);
    return `${Resources.branchScheme}${Resources.branchAction}?${query.toString()}`;
  }

  public static formatBranchDialogTitle(id: number): string {
    return `Create a branch for ${id}`;
  }

  public static formatBranchFailed(step: string, error: string): string {
    return `The Azure DevOps branch dialog's ${step} failed: ${error}`;
  }

  public static formatCommitBase(head: string): string {
    return `From commit ${head.slice(0, Resources.shortCommitLength)}, and switches to it.`;
  }

  public static formatReferenceReadFailed(error: string): string {
    return `Reading an Azure DevOps reference failed, so it shows as a plain link: ${error}`;
  }

  public static readonly workItemsInstancePattern: RegExp = /^(?<organization>[^/]+)\/(?<project>[^/]+)(?:\/(?<id>[1-9][0-9]{0,9}))?$/;
  public static readonly remoteWebProjectPattern: RegExp = /^[^/]+\/([^/]+)\/_git\/[^/]+$/;
  public static readonly remoteSshProjectPattern: RegExp = /^v3\/[^/]+\/([^/]+)\/[^/]+$/;
  public static readonly remoteCollectionProjectPattern: RegExp = /^(?:DefaultCollection\/)?([^/]+)\/_git\/[^/]+$/;
  public static readonly remoteWebRepositoryPattern: RegExp = /^[^/]+\/[^/]+\/_git\/([^/]+)$/;
  public static readonly remoteSshRepositoryPattern: RegExp = /^v3\/[^/]+\/[^/]+\/([^/]+)$/;
  public static readonly remoteCollectionRepositoryPattern: RegExp = /^(?:DefaultCollection\/)?[^/]+\/_git\/([^/]+)$/;
  public static readonly pullRequestAddressPattern: RegExp = /^https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)\/pullrequest\/\d+$/;
  public static readonly facetNames: Readonly<Record<WorkItemFacet, string>> = {
    [WorkItemFacet.Type]: "Type", [WorkItemFacet.State]: "State"
  };
  public static readonly facetAll: Readonly<Record<WorkItemFacet, string>> = {
    [WorkItemFacet.Type]: "all", [WorkItemFacet.State]: "not closed"
  };
  public static readonly allValues: string = "All";
  public static readonly noMatchingWorkItems: string = "No work items match the filters.";
  public static readonly linkedHistoryLimit: number = 1000;
  public static readonly openHistoryCommand: string = "git.openHistory";

  public static readonly linkedHistoryTitle: string = "Linked in your history";
  public static readonly linkedHistoryCap: string = "It covers the repository's last 1,000 commits.";
  public static readonly linkedCommitDateFormat: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

  public static formatCommitAge(milliseconds: number): string | null {
    const minutes: number = Math.max(1, Math.floor(milliseconds / 60_000));
    if (minutes < 60)
      return `${minutes} min`;
    const hours: number = Math.floor(minutes / 60);
    if (hours < 24)
      return `${hours} h`;
    const days: number = Math.floor(hours / 24);
    return days <= 30 ? `${days} d` : null;
  }

  public static formatLinkedHistoryNote(id: number): string {
    return `Commits in this repository that name ${id}: #${id} or AB#${id} in the subject, or AB#${id} in its message.`;
  }

  public static formatNoLinkedCommits(id: number): string {
    return `No commit read names ${id}.`;
  }

  public static formatShowCommit(subject: string): string {
    return `Show ${subject} in the history`;
  }
  public static readonly newWorkItem: string = "New work item";
  public static readonly newWorkItemIcon: IconName = "add";
  public static readonly idColumn: string = "ID";
  public static readonly titleColumn: string = "Title";
  public static readonly stateColumn: string = "State";
  public static readonly iterationColumn: string = "Iteration";
  public static readonly linksColumn: string = "Links";
  public static readonly noLinks: string = "none";
  public static readonly stateLabel: string = "State";
  public static readonly assignedLabel: string = "Assigned";
  public static readonly iterationLabel: string = "Iteration";
  public static readonly areaLabel: string = "Area";
  public static readonly pointsLabel: string = "Points";
  public static readonly parentLabel: string = "Parent";
  public static readonly unassigned: string = "Unassigned";
  public static readonly noValue: string = "—";
  public static readonly acceptanceTitle: string = "Acceptance criteria";
  public static readonly tasksTitle: string = "Tasks";
  public static readonly developmentTitle: string = "Development";
  public static readonly noDevelopment: string = "No branch, pull request or commit is linked yet.";
  public static readonly branchIcon: IconName = "alt_route";
  public static readonly pullRequestIcon: IconName = "merge";
  public static readonly commitIcon: IconName = "commit";
  public static readonly policyWarningIcon: IconName = "error";
  public static readonly categoryColors: Readonly<Record<WorkItemCategory, string>> = {
    [WorkItemCategory.Proposed]: "var(--nol-text-muted)",
    [WorkItemCategory.InProgress]: "var(--nol-accent)",
    [WorkItemCategory.Resolved]: "var(--nol-warning)",
    [WorkItemCategory.Completed]: "var(--nol-status-ok)",
    [WorkItemCategory.Removed]: "var(--nol-text-muted)"
  };

  public static formatWorkItemsInstance(organization: string, project: string, id: number | null): string {
    const place = `${organization}/${encodeURIComponent(project)}`;
    return Object.isNull(id) ? place : `${place}/${id}`;
  }

  public static formatNewWorkItemAddress(organization: string, project: string): string {
    return `${Resources.formatProjectAddress(organization, project)}/_workitems`;
  }

  public static formatPullRequestViewTitle(number: number): string {
    return `${Resources.pullRequestLabel} ${Resources.formatPullRequestReference(number)}`;
  }

  public static formatWorkItemViewTitle(id: number): string {
    return `${Resources.workItemViewLabel} ${id}`;
  }

  public static formatWorkItemPanel(id: number): string {
    return `Work item ${id}`;
  }

  public static formatWorkItemLine(id: number, title: string): string {
    return `${id} ${title}`;
  }

  public static formatFacetFilter(facet: WorkItemFacet, shown: string | null): string {
    return `${Resources.facetNames[facet]}: ${shown ?? Resources.facetAll[facet]}`;
  }

  public static formatIterationName(iteration: string): string {
    return iteration.slice(iteration.lastIndexOf(Resources.iterationSeparator) + 1);
  }

  public static formatCount(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
  }

  public static formatCommits(count: number): string {
    return Resources.formatCount(count, "commit", "commits");
  }

  public static formatChildren(count: number): string {
    return Resources.formatCount(count, "child", "children");
  }

  public static formatBranchCommits(count: number): string {
    return `${GitCounts.format(count)} ${count === 1 ? "commit" : "commits"} on this branch`;
  }

  public static formatHours(hours: number): string {
    return `${hours} h`;
  }

  public static formatHoursLeft(left: number, total: number): string {
    return `${left} h of ${total} h left`;
  }

  public static formatPolicies(passed: number, total: number): string {
    return `${passed} of ${total} policies`;
  }

  public static formatAvatarKey(organization: string, email: string): string {
    return `${organization} ${email}`;
  }

  public static readonly workItemsDocument: string = "git-azure-devops.workItems";
  public static readonly openWorkItemsCommand: string = "git-azure-devops.openWorkItems";
  public static readonly openWorkItemsTitle: string = "Open my work items";
  public static readonly noProjectNotification: string = "git-azure-devops.noProject";
  public static readonly noProjectForWorkItems: string = "Open an Azure DevOps repository in Git to see your work items.";
  public static readonly workItemsIcon: IconName = "checklist";
  public static readonly myWorkItemsTitle: string = "My work items";
  public static readonly workItemFacets: readonly WorkItemFacet[] = Object.values(WorkItemFacet);
  public static readonly filterIcon: IconName = "filter_list";
  public static readonly workItemsCapped: string = "Azure DevOps answered its first 200 work items, so the list and its filters cover only those.";
  public static readonly workItemsReading: string = "Reading your work items on Azure DevOps.";
  public static readonly workItemsUnanswered: string = "Azure DevOps didn't answer, so your work items couldn't be read.";
  public static readonly workItemsSignedOut: string = "You signed out of Azure DevOps, so your work items aren't shown. Sign in to read them again.";
  public static readonly noWorkItemsPlace: string = "Open a repository with an Azure DevOps remote to see its project's work items.";
  public static readonly noMyWorkItems: string = "No open work items are assigned to you here. If you aren't signed in, sign in in Settings → Accounts and hosts.";

  public static formatWorkItemsSubtitle(project: string): string {
    return `· ${project}`;
  }

  public static readonly boardsLabel: string = "The project's boards";
  public static readonly instanceArgument: string = "instance";
  public static readonly projectInstanceExpected: string = "The command opens an Azure DevOps project named as organization/project.";

  public static readonly viewGroup: number = 0;
  public static readonly workItemViewLabel: string = "Work item";
  public static readonly workItemView: string = "git-azure-devops.workItemDetail";
  public static readonly workItemViewInstance: string = "selected";
  public static readonly workItemViewIcon: IconName = "assignment";
  public static readonly workItemViewOrder: number = 40;
  public static readonly noWorkItemChosen: string = "Select a work item to see it here.";
  public static readonly pullRequestView: string = "git-azure-devops.pullRequestDetail";
  public static readonly pullRequestViewInstance: string = "selected";
  public static readonly pullRequestViewOrder: number = 41;
  public static readonly noPullRequestShown: string = "Open a pull request to see its details here.";
  public static readonly chipItemsBatchSize: number = 200;

  private static thenOf(deletedBranch: string | null, workItems: number): string {
    const after: string[] = [];
    if (!Object.isNull(deletedBranch))
      after.push(`deletes ${deletedBranch}`);
    if (workItems > 0)
      after.push(workItems === 1 ? "completes 1 linked work item" : `completes ${String(workItems)} linked work items`);
    return after.length === 0 ? "" : `, then ${after.join(" and ")}`;
  }
}
