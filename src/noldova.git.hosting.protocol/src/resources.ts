/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly unknownField: string = "none, since the model doesn't define it";
  public static readonly nonBlankTextExpected: string = "a text that isn't blank";
  public static readonly httpsAddressExpected: string = "an https address with no user name or password";
  public static readonly positiveExpected: string = "a whole number above zero";
  public static readonly countExpected: string = "a whole number, zero or more";
  public static readonly nameExpected: string = "a name of letters, digits, '.', '_' and '-', other than '.' and '..'";
  public static readonly pathExpected: string = "names of letters, digits, '.', '_', '-' and percent escapes such as '%20' but not of '/' or '\\' joined by '/', none of them '.' or '..', '%2e' counting as a dot";
  public static readonly namePattern: RegExp = /^(?!\.\.?$)[A-Za-z0-9._-]+$/;
  /**
   * Names joined by '/', each of letters, digits, '.', '_', '-' and percent escapes, so a name with a space or another character comes encoded; never an
   * escaped '/' or '\', which would decode to another name.
   */
  public static readonly pathPattern: RegExp = /^(?!(?:\.|%2[Ee]){1,2}(?:\/|$))(?:[A-Za-z0-9._-]|%(?!2[Ff]|5[Cc])[0-9A-Fa-f]{2})+(?:\/(?!(?:\.|%2[Ee]){1,2}(?:\/|$))(?:[A-Za-z0-9._-]|%(?!2[Ff]|5[Cc])[0-9A-Fa-f]{2})+)*$/;
  public static readonly commitExpected: string = "a full commit hash, 40 or 64 lowercase hexadecimal digits";
  public static readonly pullRequestStateExpected: string = "Open, Draft, Merged or Closed, the states of a pull request";
  public static readonly issueStateExpected: string = "Open, ClosedDone or ClosedNotPlanned, the states of an issue";
  public static readonly changesExpected: string = "changes exactly for a pull request";
  public static readonly pullRequestExpected: string = "a pull request";
  public static readonly checksExpected: string = "no checks, since there is no pull request";
  public static readonly approvalsExpected: string = "no approvals, since there is no pull request";
  public static readonly reviewDecisionExpected: string = "a review decision exactly for a pull request";
  public static readonly otherBranchExpected: string = "a branch other than the head branch";
  public static readonly commitPattern: RegExp = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
  public static readonly avatarExpected: string = "a PNG, JPEG, GIF or WebP image of at most 64 KiB as a base64 data address";
  public static readonly avatarPattern: RegExp = /^data:image\/(?:png|jpeg|gif|webp);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/;
  public static readonly maximumAvatarLength: number = 87_384;
  public static readonly closedAtExpected: string = "a time exactly when the item is merged or closed";
  public static readonly deviceCodeExpected: string = "either a device code or an address to open in the browser, exactly while the sign-in waits for the person";
  public static readonly accountExpected: string = "an account exactly while signed in";
  public static readonly failureExpected: string = "null, since only a sign-out has a failure";
  public static readonly eachOnceExpected: string = "each capability at most once";
  public static readonly voteExpected: string = "a number from -1 to 1";
  public static readonly finishedAtExpected: string = "a finish time exactly when the build has finished, no earlier than its start";
  public static readonly colorExpected: string = "a color of six hexadecimal digits";
  public static readonly colorPattern: RegExp = /^[0-9A-Fa-f]{6}$/;
  public static readonly imageExpected: string = "an SVG image of at most 65536 characters";
  public static readonly svgPattern: RegExp = /^\s*(?:<\?xml[^>]*\?>\s*)?<svg[\s>]/u;
  public static readonly maximumImageLength: number = 65_536;
  public static readonly parentExpected: string = "a parent other than the work item itself";
  public static readonly idsScopeExpected: string = "work item ids, each once, exactly for the Ids scope";
  public static readonly amountExpected: string = "a number, zero or more";
  public static readonly finiteExpected: string = "a number";
  public static readonly childrenExpected: string = "children, each once and none the work item itself";
  public static readonly changeExpected: string = "a new state, an assignment to the signed-in person, or both";
  public static readonly maximumPullRequestRows: number = 20;
  public static readonly rowsExpected: string = "at most 20 pull requests, and none while signed out";
  public static readonly hasMoreExpected: string = "more only after 20 pull requests";
  public static readonly maximumPullRequestHeads: number = 100;
  public static readonly pullRequestHeadsExpected: string = "at most 100 pull requests, and none while signed out";
  public static readonly pullRequestHeadsMoreExpected: string = "more only after 100 pull requests";
  public static readonly maximumReviewRequestRows: number = 100;
  public static readonly reviewRequestRowsExpected: string = "at most 100 review requests, and none while signed out";
  public static readonly reviewRequestsMoreExpected: string = "more only while signed in";
  public static readonly maximumPullRequestCommits: number = 250;
  public static readonly pullRequestCommitsExpected: string = "at most 250 commits";
  public static readonly pullRequestCommitsMoreExpected: string = "more only after 250 commits";
  public static readonly maximumPullRequestUpdates: number = 100;
  public static readonly pullRequestUpdatesExpected: string = "at most 100 updates";
  public static readonly pullRequestUpdatesMoreExpected: string = "more only after 100 updates";
  public static readonly maximumPullRequestFiles: number = 5000;
  public static readonly pullRequestFilesExpected: string = "at most 5000 files";
  public static readonly pullRequestFilesCommitExpected: string = "a head commit for a common commit, files or more";
  public static readonly previousPathExpected: string = "a previous path for a moved file only";
  public static readonly maximumPullRequestConflicts: number = 100;
  public static readonly pullRequestConflictsExpected: string = "at most 100 conflicts";
  public static readonly pullRequestConflictsMoreExpected: string = "more only after 100 conflicts";
  public static readonly filesField: string = "files";
  public static readonly pathsField: string = "paths";
  public static readonly previousPathField: string = "previousPath";
  public static readonly maximumCommitComments: number = 100;
  public static readonly commitCommentsExpected: string = "at most 100 comments";
  public static readonly commitCommentsCappedExpected: string = "capped only with comments";
  public static readonly commitCommentsUrlExpected: string = "a page exactly when there are comments";
  public static readonly countsExpected: string = "zero counts when the host doesn't count them";
  public static readonly commentParentExpected: string = "a parent other than the comment itself";
  public static readonly lineExpected: string = "a line only on a thread that names a file";
  public static readonly commentsExpected: string = "at least one comment";

  public static readonly stateField: string = "state";
  public static readonly deviceCodeField: string = "deviceCode";
  public static readonly addressField: string = "address";
  public static readonly accountField: string = "account";
  public static readonly failureField: string = "failure";
  public static readonly userCodeField: string = "userCode";
  public static readonly verificationUriField: string = "verificationUri";
  public static readonly expiresAtField: string = "expiresAt";
  public static readonly loginField: string = "login";
  public static readonly nameField: string = "name";
  public static readonly avatarField: string = "avatar";
  public static readonly scopesField: string = "scopes";
  public static readonly httpsProtocol: string = "https:";
  public static readonly hostField: string = "host";
  public static readonly ownerField: string = "owner";
  public static readonly repositoryField: string = "repository";
  public static readonly numberField: string = "number";
  public static readonly referenceField: string = "reference";
  public static readonly kindField: string = "kind";
  public static readonly titleField: string = "title";
  public static readonly urlField: string = "url";
  public static readonly authorField: string = "author";
  public static readonly createdAtField: string = "createdAt";
  public static readonly closedAtField: string = "closedAt";
  public static readonly commentsField: string = "comments";
  public static readonly countField: string = "count";
  public static readonly isCappedField: string = "isCapped";
  public static readonly changesField: string = "changes";
  public static readonly additionsField: string = "additions";
  public static readonly deletionsField: string = "deletions";
  public static readonly changedFilesField: string = "changedFiles";
  public static readonly headBranchField: string = "headBranch";
  public static readonly baseBranchField: string = "baseBranch";
  public static readonly headCommitField: string = "headCommit";
  public static readonly isCountedField: string = "isCounted";
  public static readonly pathField: string = "path";
  public static readonly branchField: string = "branch";
  public static readonly emailField: string = "email";
  public static readonly commitField: string = "commit";
  public static readonly pullRequestField: string = "pullRequest";
  public static readonly checksField: string = "checks";
  public static readonly reviewDecisionField: string = "reviewDecision";
  public static readonly bodyField: string = "body";
  public static readonly isDraftField: string = "isDraft";
  public static readonly capabilitiesField: string = "capabilities";
  public static readonly personField: string = "person";
  public static readonly voteField: string = "vote";
  public static readonly voteLabelField: string = "voteLabel";
  public static readonly isRequiredField: string = "isRequired";
  public static readonly isBlockingField: string = "isBlocking";
  public static readonly startedAtField: string = "startedAt";
  public static readonly finishedAtField: string = "finishedAt";
  public static readonly buildNumberField: string = "buildNumber";
  public static readonly itemField: string = "item";
  public static readonly reviewersField: string = "reviewers";
  public static readonly policiesField: string = "policies";
  public static readonly buildsField: string = "builds";
  public static readonly isAutoCompleteField: string = "isAutoComplete";
  public static readonly descriptionField: string = "description";
  public static readonly commitCountField: string = "commitCount";
  public static readonly workItemsField: string = "workItems";
  public static readonly autoCompleteMergeTypeField: string = "autoCompleteMergeType";
  public static readonly hasConflictsField: string = "hasConflicts";
  public static readonly colorField: string = "color";
  public static readonly iconField: string = "icon";
  public static readonly imageField: string = "image";
  public static readonly organizationField: string = "organization";
  public static readonly projectField: string = "project";
  public static readonly idField: string = "id";
  public static readonly typeField: string = "type";
  public static readonly categoryField: string = "category";
  public static readonly assigneeField: string = "assignee";
  public static readonly iterationField: string = "iteration";
  public static readonly areaField: string = "area";
  public static readonly parentField: string = "parent";
  public static readonly changedAtField: string = "changedAt";
  public static readonly scopeField: string = "scope";
  public static readonly idsField: string = "ids";
  public static readonly pointsField: string = "points";
  public static readonly remainingField: string = "remaining";
  public static readonly completedField: string = "completed";
  public static readonly orderField: string = "order";
  public static readonly acceptanceField: string = "acceptance";
  public static readonly childrenField: string = "children";
  public static readonly pullRequestsField: string = "pullRequests";
  public static readonly commitsField: string = "commits";
  public static readonly branchesField: string = "branches";
  public static readonly isWaitingField: string = "isWaiting";
  public static readonly assignToMeField: string = "assignToMe";
  public static readonly approvalsField: string = "approvals";
  public static readonly passedField: string = "passed";
  public static readonly failingField: string = "failing";
  public static readonly pendingField: string = "pending";
  public static readonly rowsField: string = "rows";
  public static readonly hasMoreField: string = "hasMore";
  public static readonly threadsField: string = "threads";
  public static readonly subjectField: string = "subject";
  public static readonly authoredAtField: string = "authoredAt";
  public static readonly sourceCommitField: string = "sourceCommit";
  public static readonly commonCommitField: string = "commonCommit";
  public static readonly updatesField: string = "updates";
  public static readonly isSignedInField: string = "isSignedIn";
  public static readonly itemsField: string = "items";
  public static readonly isTruncatedField: string = "isTruncated";
  public static readonly lineField: string = "line";
  public static readonly publishedAtField: string = "publishedAt";


  public static formatFieldPath(parent: string, field: string): string {
    return `${parent}.${field}`;
  }

  public static formatInvalidField(field: string, expectation: string): string {
    return `The field ${field} is invalid: expected ${expectation}.`;
  }

  public static formatInvalidArgument(parameterName: string, expectation: string): string {
    return `The argument ${parameterName} is invalid: expected ${expectation}.`;
  }

  public static formatMemberExpected(members: readonly string[]): string {
    return `one of ${members.join(", ")}`;
  }

  public static formatMemberName(moduleId: string, member: string): string {
    return `${moduleId}.${member}`;
  }

  public static formatReference(owner: string, repository: string, number: number): string {
    return `${owner}/${repository}#${number}`;
  }
}
