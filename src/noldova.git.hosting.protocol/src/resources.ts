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
  public static readonly pathExpected: string = "names of letters, digits, '.', '_' and '-' joined by '/', none of them '.' or '..'";
  public static readonly namePattern: RegExp = /^(?!\.\.?$)[A-Za-z0-9._-]+$/;
  public static readonly pathPattern: RegExp = /^(?!\.\.?(?:\/|$))[A-Za-z0-9._-]+(?:\/(?!\.\.?(?:\/|$))[A-Za-z0-9._-]+)*$/;
  public static readonly commitExpected: string = "a full commit hash, 40 or 64 lowercase hexadecimal digits";
  public static readonly pullRequestStateExpected: string = "Open, Draft, Merged or Closed, the states of a pull request";
  public static readonly issueStateExpected: string = "Open, ClosedDone or ClosedNotPlanned, the states of an issue";
  public static readonly changesExpected: string = "changes exactly for a pull request";
  public static readonly pullRequestExpected: string = "a pull request";
  public static readonly checksExpected: string = "no checks, since there is no pull request";
  public static readonly reviewDecisionExpected: string = "a review decision exactly for a pull request";
  public static readonly otherBranchExpected: string = "a branch other than the head branch";
  public static readonly commitPattern: RegExp = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
  public static readonly avatarExpected: string = "a PNG, JPEG, GIF or WebP image of at most 64 KiB as a base64 data address";
  public static readonly avatarPattern: RegExp = /^data:image\/(?:png|jpeg|gif|webp);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/;
  public static readonly maximumAvatarLength: number = 87_384;
  public static readonly closedAtExpected: string = "a time exactly when the item is merged or closed";
  public static readonly deviceCodeExpected: string = "a device code exactly while the sign-in waits for the person";
  public static readonly accountExpected: string = "an account exactly while signed in";
  public static readonly failureExpected: string = "null, since only a sign-out has a failure";
  public static readonly stateField: string = "state";
  public static readonly deviceCodeField: string = "deviceCode";
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
  public static readonly changesField: string = "changes";
  public static readonly additionsField: string = "additions";
  public static readonly deletionsField: string = "deletions";
  public static readonly changedFilesField: string = "changedFiles";
  public static readonly headBranchField: string = "headBranch";
  public static readonly baseBranchField: string = "baseBranch";
  public static readonly headCommitField: string = "headCommit";
  public static readonly pathField: string = "path";
  public static readonly branchField: string = "branch";
  public static readonly pullRequestField: string = "pullRequest";
  public static readonly checksField: string = "checks";
  public static readonly reviewDecisionField: string = "reviewDecision";
  public static readonly bodyField: string = "body";
  public static readonly isDraftField: string = "isDraft";

  public static formatFieldPath(parent: string, field: string): string {
    return `${parent}.${field}`;
  }

  public static formatInvalidField(field: string, expectation: string): string {
    return `The field ${field} is invalid: expected ${expectation}.`;
  }

  public static formatInvalidArgument(parameterName: string, expectation: string): string {
    return `The argument ${parameterName} is invalid: expected ${expectation}.`;
  }

  public static formatMemberName(moduleId: string, member: string): string {
    return `${moduleId}.${member}`;
  }

  public static formatReference(owner: string, repository: string, number: number): string {
    return `${owner}/${repository}#${number}`;
  }
}
