/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, type ExceptionOptions } from "@noldova/context.exceptions";
import type { JsonException, JsonObject, JsonReader } from "@noldova/context.json";

export type { JsonObject, JsonValue } from "@noldova/context.json";

/**
 * Where a host module's sign-in stands on this computer.
 *
 * @example
 * ```ts
 * import { SignInState } from "@noldova/git.hosting.protocol";
 *
 * console.log(SignInState.Waiting);
 * ```
 */
export declare const SignInState: {
  /**
   * No account is signed in.
   */
  readonly SignedOut: "SignedOut";

  /**
   * The sign-in waits for the person: to enter the code the host showed on the host's page, or to finish signing in in the browser.
   */
  readonly Waiting: "Waiting";

  /**
   * An account is signed in, and its token is kept in the module's secrets on this computer.
   */
  readonly SignedIn: "SignedIn";
};

/**
 * Where a host module's sign-in stands on this computer.
 */
export type SignInState = (typeof SignInState)[keyof typeof SignInState];

/**
 * Why the last sign-in ended signed out.
 *
 * @example
 * ```ts
 * import { SignInFailure } from "@noldova/git.hosting.protocol";
 *
 * console.log(SignInFailure.Expired);
 * ```
 */
export declare const SignInFailure: {
  /**
   * The code expired before the person entered it.
   */
  readonly Expired: "Expired";

  /**
   * The person declined the app's access on the host's page.
   */
  readonly Denied: "Denied";

  /**
   * The host no longer accepts the kept token, which the module forgot.
   */
  readonly Revoked: "Revoked";

  /**
   * The host couldn't be reached.
   */
  readonly Unreachable: "Unreachable";

  /**
   * The host refused the request or answered in a way the module doesn't read.
   */
  readonly Refused: "Refused";

  /**
   * The token couldn't be kept in the module's secrets on this computer.
   */
  readonly Unkept: "Unkept";

  /**
   * The person signed out, but the token couldn't be removed from the module's secrets on this computer, so a later start may restore it.
   */
  readonly Unforgotten: "Unforgotten";

  /**
   * An added account signed in as an account the module already keeps, so its token was forgotten and the account isn't added twice.
   */
  readonly AlreadyKept: "AlreadyKept";
};

/**
 * Why the last sign-in ended signed out.
 */
export type SignInFailure = (typeof SignInFailure)[keyof typeof SignInFailure];

/**
 * Whether an item on a host is a pull request or an issue.
 *
 * @example
 * ```ts
 * import { ReferenceKind } from "@noldova/git.hosting.protocol";
 *
 * console.log(ReferenceKind.PullRequest);
 * ```
 */
export declare const ReferenceKind: {
  /**
   * A pull request, or a merge request on a host that calls it so.
   */
  readonly PullRequest: "PullRequest";

  /**
   * An issue.
   */
  readonly Issue: "Issue";
};

/**
 * Whether an item on a host is a pull request or an issue.
 */
export type ReferenceKind = (typeof ReferenceKind)[keyof typeof ReferenceKind];

/**
 * Where a pull request or an issue stands on its host: a pull request is `Open`, `Draft`, `Merged` or `Closed`, and an issue is `Open`,
 * `ClosedDone` or `ClosedNotPlanned`.
 *
 * @example
 * ```ts
 * import { ReferenceState } from "@noldova/git.hosting.protocol";
 *
 * console.log(ReferenceState.Merged);
 * ```
 */
export declare const ReferenceState: {
  /**
   * A pull request ready for review, or an issue, that is open.
   */
  readonly Open: "Open";

  /**
   * A pull request that is open as a draft.
   */
  readonly Draft: "Draft";

  /**
   * A pull request whose changes were merged.
   */
  readonly Merged: "Merged";

  /**
   * A pull request closed without being merged.
   */
  readonly Closed: "Closed";

  /**
   * An issue closed as done.
   */
  readonly ClosedDone: "ClosedDone";

  /**
   * An issue closed as not planned.
   */
  readonly ClosedNotPlanned: "ClosedNotPlanned";
};

/**
 * Where a pull request or an issue stands on its host.
 */
export type ReferenceState = (typeof ReferenceState)[keyof typeof ReferenceState];

/**
 * What a pull request did to a file.
 *
 * @example
 * ```ts
 * import { FileChangeKind } from "@noldova/git.hosting.protocol";
 *
 * console.log(FileChangeKind.Renamed);
 * ```
 */
export declare const FileChangeKind: {
  /**
   * The pull request adds the file.
   */
  readonly Added: "Added";

  /**
   * The pull request changes the file in place.
   */
  readonly Modified: "Modified";

  /**
   * The pull request deletes the file.
   */
  readonly Deleted: "Deleted";

  /**
   * The pull request moves the file, with or without changes.
   */
  readonly Renamed: "Renamed";
};

/**
 * What a pull request did to a file.
 */
export type FileChangeKind = (typeof FileChangeKind)[keyof typeof FileChangeKind];

/**
 * Where a check on a commit stands, such as a CI job.
 *
 * @example
 * ```ts
 * import { CheckState } from "@noldova/git.hosting.protocol";
 *
 * console.log(CheckState.Failed);
 * ```
 */
export declare const CheckState: {
  /**
   * The check waits to start.
   */
  readonly Queued: "Queued";

  /**
   * The check runs.
   */
  readonly Running: "Running";

  /**
   * The check finished and passed.
   */
  readonly Succeeded: "Succeeded";

  /**
   * The check finished and failed.
   */
  readonly Failed: "Failed";

  /**
   * The check finished with no verdict, such as one skipped or neutral on the host.
   */
  readonly Neutral: "Neutral";
};

/**
 * Where a check on a commit stands.
 */
export type CheckState = (typeof CheckState)[keyof typeof CheckState];

/**
 * Where a pull request's review stands, from each reviewer's latest review that approves or requests changes.
 * A host counts the reviewers it takes to speak for the repository; GitHub's module takes its owner, members and collaborators, which is close to
 * the people with write access but not exact.
 *
 * @example
 * ```ts
 * import { ReviewDecision } from "@noldova/git.hosting.protocol";
 *
 * console.log(ReviewDecision.ChangesRequested);
 * ```
 */
export declare const ReviewDecision: {
  /**
   * No reviewer's latest review approves or requests changes.
   */
  readonly Waiting: "Waiting";

  /**
   * A reviewer's latest review requests changes.
   */
  readonly ChangesRequested: "ChangesRequested";

  /**
   * A reviewer's latest review approves, and none requests changes.
   */
  readonly Approved: "Approved";
};

/**
 * Where a pull request's review stands.
 */
export type ReviewDecision = (typeof ReviewDecision)[keyof typeof ReviewDecision];


/**
 * The base of the hosting protocol's own exceptions; catch it to catch them all.
 * A model's `fromJson` also throws context's `JsonException`, which isn't under this base.
 * It is abstract: a model's constructor throws {@link HostingArgumentException}, and its `fromJson` {@link HostingFieldException}.
 *
 * @example
 * ```ts
 * import { HostingProtocolException, HostReference } from "@noldova/git.hosting.protocol";
 *
 * try {
 *   HostReference.fromJson({ host: "git-github", owner: "team", repository: "repo", number: 0 });
 * }
 * catch (error) {
 *   if (error instanceof HostingProtocolException)
 *     console.log(error.message);
 * }
 * ```
 */
export declare abstract class HostingProtocolException extends Exception {
  /**
   * Makes the failure; only the hosting protocol's own exceptions call it.
   *
   * @param message The message, from the protocol's resources.
   * @param options The cause, when there is one.
   * @example
   * ```ts
   * import { HostingArgumentException } from "@noldova/git.hosting.protocol";
   *
   * const failure = new HostingArgumentException("login", "a text that isn't blank");
   * console.log(failure.message);
   * ```
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The failure a model's constructor throws for a part it can't take, naming the parameter.
 *
 * @example
 * ```ts
 * import { HostingArgumentException, HostReference } from "@noldova/git.hosting.protocol";
 *
 * try {
 *   new HostReference("git-github", "team", "repo", 0);
 * }
 * catch (error) {
 *   if (error instanceof HostingArgumentException)
 *     console.log(error.parameterName);
 * }
 * ```
 */
export declare class HostingArgumentException extends HostingProtocolException {
  /**
   * The refused parameter's name, such as `number`.
   */
  public readonly parameterName: string;

  /**
   * What the parameter must hold, such as `a whole number above zero`, which the message names.
   */
  public readonly expectation: string;

  /**
   * Makes the failure for a parameter and what it expected.
   *
   * @param parameterName The parameter's name.
   * @param expectation What the parameter must hold.
   * @example
   * ```ts
   * import { HostingArgumentException } from "@noldova/git.hosting.protocol";
   *
   * export function refuseNumber(): never {
   *   throw new HostingArgumentException("number", "a whole number above zero");
   * }
   * ```
   */
  public constructor(parameterName: string, expectation: string);
}

/**
 * The failure a model's `fromJson` throws for a field it can't take, naming the field by its path.
 *
 * @example
 * ```ts
 * import { HostingFieldException, HostReference } from "@noldova/git.hosting.protocol";
 *
 * try {
 *   HostReference.fromJson({ host: "git-github", owner: "team", repository: "repo", number: 0 });
 * }
 * catch (error) {
 *   if (error instanceof HostingFieldException)
 *     console.log(error.field);
 * }
 * ```
 */
export declare class HostingFieldException extends HostingProtocolException {
  /**
   * The field's path, such as `$.reference.number`.
   */
  public readonly field: string;

  /**
   * What the field must hold, such as `a whole number above zero`, which the message names.
   */
  public readonly expectation: string;

  /**
   * Makes the failure for a field and what it expected.
   *
   * @param field The field's path.
   * @param expectation What the field must hold.
   * @example
   * ```ts
   * import { HostingFieldException } from "@noldova/git.hosting.protocol";
   *
   * export function refuseNumber(): never {
   *   throw new HostingFieldException("$.reference.number", "a whole number above zero");
   * }
   * ```
   */
  public constructor(field: string, expectation: string);
}

/**
 * The one-time code a device sign-in shows, the host's page where the person enters it, and when it expires.
 *
 * @example
 * ```ts
 * import { DeviceCode } from "@noldova/git.hosting.protocol";
 *
 * const code = new DeviceCode("WDJB-MJHT", "https://github.com/login/device", Date.now() + 900_000);
 * console.log(code.toJson());
 * ```
 */
export declare class DeviceCode {
  /**
   * The code the person enters on the host's page.
   */
  public readonly userCode: string;

  /**
   * The host's https page where the person enters the code.
   */
  public readonly verificationUri: string;

  /**
   * When the code expires, in milliseconds since the Unix epoch.
   */
  public readonly expiresAt: number;

  /**
   * Makes a code from its parts.
   *
   * @param userCode The code, which isn't blank.
   * @param verificationUri The host's https page.
   * @param expiresAt When the code expires, a whole number of milliseconds above zero.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `userCode`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.userCode`.
   * @example
   * ```ts
   * import { DeviceCode } from "@noldova/git.hosting.protocol";
   *
   * const code = new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_000_000);
   * // @ts-expect-error The expiry is a number of milliseconds, not a date.
   * new DeviceCode("WDJB-MJHT", "https://github.com/login/device", new Date());
   * ```
   */
  public constructor(userCode: string, verificationUri: string, expiresAt: number, reader?: JsonReader);

  /**
   * Reads a code from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The code.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When a field is unknown or out of its range.
   * @example
   * ```ts
   * import { DeviceCode } from "@noldova/git.hosting.protocol";
   *
   * const code = DeviceCode.fromJson({ userCode: "WDJB-MJHT", verificationUri: "https://github.com/login/device", expiresAt: 1_800_000_000_000 });
   * console.log(code.userCode);
   * ```
   */
  public static fromJson(value: unknown, path?: string): DeviceCode;

  /**
   * Writes the code as JSON: `userCode`, `verificationUri` and `expiresAt`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { DeviceCode } from "@noldova/git.hosting.protocol";
   *
   * console.log(new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_000_000).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The account a host module is signed in to: its login, its display name, its avatar and the access its token was given.
 *
 * @example
 * ```ts
 * import { HostAccount } from "@noldova/git.hosting.protocol";
 *
 * const account = new HostAccount("octocat", "The Octocat", "data:image/png;base64,iVBORw0KGgo=", ["repo"]);
 * console.log(account.login);
 * ```
 */
export declare class HostAccount {
  /**
   * The account's login on the host.
   */
  public readonly login: string;

  /**
   * The account's display name, or null when it has none.
   */
  public readonly name: string | null;

  /**
   * The account's avatar as a base64 data address of a PNG, JPEG, GIF or WebP image of at most 64 KiB, which a window can show under a policy that
   * allows only its own and data images; null when the host gives none or the module couldn't read it.
   */
  public readonly avatar: string | null;

  /**
   * The access the host gave the token, in the host's own scope names, such as GitHub's `repo`.
   */
  public readonly scopes: readonly string[];

  /**
   * Makes an account from its parts.
   *
   * @param login The login, which isn't blank.
   * @param name The display name, which isn't blank, or null.
   * @param avatar The avatar as a base64 data address of a PNG, JPEG, GIF or WebP image of at most 64 KiB, or null.
   * @param scopes The token's scopes, none blank.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `login`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.login`.
   * @example
   * ```ts
   * import { HostAccount } from "@noldova/git.hosting.protocol";
   *
   * const account = new HostAccount("octocat", null, null, ["repo"]);
   * // @ts-expect-error The scopes are a list, not one text.
   * new HostAccount("octocat", null, null, "repo");
   * ```
   */
  public constructor(login: string, name: string | null, avatar: string | null, scopes: readonly string[], reader?: JsonReader);

  /**
   * Reads an account from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The account.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When a field is unknown or out of its range.
   * @example
   * ```ts
   * import { HostAccount } from "@noldova/git.hosting.protocol";
   *
   * const account = HostAccount.fromJson({ login: "octocat", name: null, avatar: null, scopes: ["repo"] });
   * console.log(account.scopes);
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostAccount;

  /**
   * Writes the account as JSON: `login`, `name`, `avatar` and `scopes`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostAccount } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostAccount("octocat", null, null, []).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A host module's sign-in on this computer: its state, the code while it waits, the account while signed in, and why it last ended signed
 * out.
 *
 * @example
 * ```ts
 * import { HostSignIn, SignInFailure } from "@noldova/git.hosting.protocol";
 *
 * console.log(HostSignIn.signedOut(SignInFailure.Expired).toJson());
 * ```
 */
export declare class HostSignIn {
  /**
   * Where the sign-in stands.
   */
  public readonly state: SignInState;

  /**
   * The code, while the sign-in waits for the person to enter it, or null.
   */
  public readonly deviceCode: DeviceCode | null;

  /**
   * The https address, while the sign-in waits for the person to finish it in the browser, or null.
   */
  public readonly address: string | null;

  /**
   * The account, exactly while signed in.
   */
  public readonly account: HostAccount | null;

  /**
   * Why the last sign-in ended signed out, only while signed out, or null.
   */
  public readonly failure: SignInFailure | null;

  /**
   * Makes a sign-in from its parts.
   *
   * @param state Where it stands.
   * @param deviceCode The code, while it waits for the person to enter it; while it waits, exactly one of `deviceCode` and `address`.
   * @param account The account, exactly while signed in.
   * @param failure The failure, only while signed out.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @param address The https address, while it waits for the person in the browser; null by default, as for a sign-in made before 0.0.7, which had none.
   * @throws {HostingArgumentException} Without a reader, when the parts don't fit the state, naming the field as the parameter, such as `account`.
   * @throws {HostingFieldException} With a reader, when the parts don't fit the state, naming the field by its path, such as `$.account`.
   * @example
   * ```ts
   * import { HostSignIn, SignInFailure, SignInState } from "@noldova/git.hosting.protocol";
   *
   * const signIn = new HostSignIn(SignInState.SignedOut, null, null, SignInFailure.Denied);
   * console.log(signIn.failure);
   * ```
   */
  public constructor(state: SignInState, deviceCode: DeviceCode | null, account: HostAccount | null, failure: SignInFailure | null, reader?: JsonReader,
    address?: string | null);

  /**
   * A sign-out, with why the last sign-in ended or null.
   *
   * @param failure Why it ended; left out when nothing failed.
   * @returns The sign-in.
   * @example
   * ```ts
   * import { HostSignIn, SignInFailure } from "@noldova/git.hosting.protocol";
   *
   * console.log(HostSignIn.signedOut().failure, HostSignIn.signedOut(SignInFailure.Revoked).failure);
   * ```
   */
  public static signedOut(failure?: SignInFailure): HostSignIn;

  /**
   * A sign-in that waits for the person to enter its code.
   *
   * @param deviceCode The code.
   * @returns The sign-in.
   * @example
   * ```ts
   * import { DeviceCode, HostSignIn } from "@noldova/git.hosting.protocol";
   *
   * const signIn = HostSignIn.waiting(new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_000_000));
   * console.log(signIn.deviceCode?.userCode);
   * ```
   */
  public static waiting(deviceCode: DeviceCode): HostSignIn;

  /**
   * A sign-in that waits for the person to finish it in the browser.
   *
   * @param address The https address the browser opens.
   * @returns The sign-in.
   * @throws {HostingArgumentException} When the address isn't https.
   * @example
   * ```ts
   * import { HostSignIn } from "@noldova/git.hosting.protocol";
   *
   * const signIn = HostSignIn.waitingInBrowser("https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?client_id=contoso");
   * console.log(signIn.address);
   * ```
   */
  public static waitingInBrowser(address: string): HostSignIn;

  /**
   * A signed-in account.
   *
   * @param account The account.
   * @returns The sign-in.
   * @example
   * ```ts
   * import { HostAccount, HostSignIn } from "@noldova/git.hosting.protocol";
   *
   * const signIn = HostSignIn.signedIn(new HostAccount("octocat", null, null, ["repo"]));
   * console.log(signIn.account?.login);
   * ```
   */
  public static signedIn(account: HostAccount): HostSignIn;

  /**
   * Reads a sign-in from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The sign-in.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When a field is unknown, out of its range or doesn't fit the state.
   * @example
   * ```ts
   * import { HostSignIn } from "@noldova/git.hosting.protocol";
   *
   * const signIn = HostSignIn.fromJson({ state: "SignedOut", deviceCode: null, address: null, account: null, failure: "Expired" });
   * console.log(signIn.state);
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostSignIn;

  /**
   * Writes the sign-in as JSON: `state`, `deviceCode`, `account` and `failure`, each null when it has none, and `address` only while it waits in the browser.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostSignIn } from "@noldova/git.hosting.protocol";
   *
   * console.log(HostSignIn.signedOut().toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The member names every host module gives its sign-in's methods and event, after its own module id and a dot.
 *
 * @example
 * ```ts
 * import { HostingNames } from "@noldova/git.hosting.protocol";
 *
 * console.log(HostingNames.nameOf("git-github", HostingNames.readSignInMethod));
 * ```
 */
export declare class HostingNames {
  /**
   * The method that answers the sign-in as `HostSignIn` JSON.
   */
  public static readonly readSignInMethod: string;

  /**
   * The method that starts a sign-in, or leaves one that waits or is signed in as it is, and answers the sign-in.
   * It takes nothing for the first account, or `AccountQuery` JSON for another, on a module that keeps several.
   */
  public static readonly startSignInMethod: string;

  /**
   * The method that stops a sign-in that waits, and answers the sign-in.
   * It takes nothing for the first account, or `AccountQuery` JSON for another, on a module that keeps several.
   */
  public static readonly cancelSignInMethod: string;

  /**
   * The method that takes `{ "token": string }`, a personal access token the person pasted, checks it with the host, keeps it on this computer and
   * answers the sign-in; for hosts whose sign-in is a token rather than a device code.
   */
  public static readonly signInWithTokenMethod: string;

  /**
   * The method that forgets the kept token on this computer, and answers the sign-in.
   * It takes nothing for the first account, or `AccountQuery` JSON for another, on a module that keeps several; a signed-out account other than
   * the first leaves the list.
   */
  public static readonly signOutMethod: string;

  /**
   * The event that carries the sign-in as `HostSignIn` JSON each time it changes.
   */
  public static readonly signInChangedEvent: string;

  /**
   * The method that answers every account kept on this computer as `HostAccountList` JSON, the first account first, on a module that keeps
   * several.
   */
  public static readonly readAccountsMethod: string;

  /**
   * The method that starts a sign-in for a new account and answers it as `HostAccountEntry` JSON, its sign-in waiting.
   */
  public static readonly addAccountMethod: string;

  /**
   * The method that takes a `RepositoryQuery` as JSON and answers the account the module reads that repository with, as `RepositoryAccount` JSON.
   */
  public static readonly readRepositoryAccountMethod: string;

  /**
   * The method that takes an `AccountPick` as JSON, remembers the account for that repository on this computer, and answers it as
   * `RepositoryAccount` JSON.
   */
  public static readonly pickAccountMethod: string;

  /**
   * The event that carries every account as `HostAccountList` JSON each time one is added, signs in, signs out or leaves.
   */
  public static readonly accountsChangedEvent: string;

  /**
   * The method that takes a `HostReference` as JSON and answers the pull request or issue as `HostItem` JSON, or null when the module can't
   * show it.
   */
  public static readonly readReferenceMethod: string;

  /**
   * The method that takes a `BranchQuery` as JSON and answers the branch's pull request with its checks as `BranchPullRequest` JSON.
   */
  public static readonly readBranchPullRequestMethod: string;

  /**
   * The method that takes a `CommitQuery` as JSON and answers the pull request that brought the commit in, with its checks, as
   * `BranchPullRequest` JSON, or no pull request when none did or the module can't show it.
   */
  public static readonly readCommitPullRequestMethod: string;

  /**
   * The method that takes a `HostReference` to a pull request as JSON and answers it with its reviewers, policies and builds as `HostPullRequest`
   * JSON, or null when the host can't show it.
   */
  public static readonly readPullRequestMethod: string;

  /**
   * The method that takes a `PullRequestDraft` as JSON, opens the pull request on the host and answers it as `HostItem` JSON.
   */
  public static readonly createPullRequestMethod: string;

  /**
   * The method that takes an `AuthorQuery` as JSON and answers the author's picture on the host as `HostAvatar` JSON.
   */
  public static readonly readAuthorAvatarMethod: string;

  /**
   * The method that takes a `PersonQuery` as JSON and answers the person's picture on the host as `HostAvatar` JSON.
   */
  public static readonly readPersonAvatarMethod: string;

  /**
   * The method that takes a `WorkItemQuery` as JSON and answers the work item with its type, state, assignee, iteration, area and parent as
   * `HostWorkItem` JSON, or null when the host can't show it.
   */
  public static readonly readWorkItemMethod: string;

  /**
   * The method that takes a `WorkItemsQuery` as JSON and answers its work items as a `HostWorkItemList`, each parent before its children, with
   * whether the query's search stopped at its limit; no items when signed out or when the query is another host's.
   */
  public static readonly readWorkItemsMethod: string;

  /**
   * The method that takes a `WorkItemUpdate` as JSON, changes the work item on the host for the signed-in person, and answers the changed work
   * item as `HostWorkItem` JSON; null when signed out or when the update is another host's.
   */
  public static readonly updateWorkItemMethod: string;

  /**
   * The method that takes a `RepositoryQuery` as JSON and answers the repository's open pull requests as `HostPullRequestList` JSON, the most
   * recently updated first; signed out, `HostPullRequestList.signedOut()`, having asked the host nothing.
   */
  public static readonly readPullRequestsMethod: string;

  /**
   * The method that takes a `RepositoryQuery` as JSON and answers the open pull requests on that repository that ask the signed-in person for a
   * review as `HostReviewRequestList` JSON, the newest first; signed out, `HostReviewRequestList.signedOut()`, having asked the host nothing.
   */
  public static readonly readReviewRequestsMethod: string;

  /**
   * The method that takes a `CommitQuery` as JSON and answers the review comments on that commit as `HostCommitComments` JSON: their count, whether
   * a page of the host's answer was full, and the page that shows them; `HostCommitComments.none()` when signed out, for another host, or when the host
   * has nothing that counts them.
   */
  public static readonly readCommitCommentsMethod: string;

  /**
   * The method that takes a pull request's `HostReference` as JSON and answers its comment threads as `HostPullRequestThreads` JSON, oldest first,
   * leaving out the threads the host writes for itself, with `hasMore` when the host keeps older comments than it answers; no threads when the host
   * can't show them.
   */
  public static readonly readPullRequestThreadsMethod: string;

  /**
   * The field of a method failure's `details` that holds, as milliseconds since the epoch, when the host's rate limit for the account resets, on a
   * failure because that limit is used up. A window writes that time by the person's time and date format settings; the failure's message names it
   * too, for logs and agent tools.
   */
  public static readonly rateLimitedUntilDetail: string;

  /**
   * A member's full name in a module.
   *
   * @param moduleId The host module's id, such as `git-github`.
   * @param member The member's name.
   * @returns The name, `<module id>.<member>`.
   * @example
   * ```ts
   * import { HostingNames } from "@noldova/git.hosting.protocol";
   *
   * console.log(HostingNames.nameOf("git-github", HostingNames.signOutMethod));
   * ```
   */
  public static nameOf(moduleId: string, member: string): string;
}


/**
 * An issue or pull request on a host, such as GitHub, by the host module's id, the repository's owner and name, and its number.
 *
 * @example
 * ```ts
 * import { HostReference } from "@noldova/git.hosting.protocol";
 *
 * const reference = new HostReference("git-github", "team", "repo", 7);
 * console.log(reference.text);
 * ```
 */
export declare class HostReference {
  /**
   * The id of the host module that reads the reference, as its module.json declares it.
   */
  public readonly host: string;

  /**
   * The owner of the repository on the host: a person or an organization.
   */
  public readonly owner: string;

  /**
   * The repository's name on the host.
   */
  public readonly repository: string;

  /**
   * The issue's or pull request's number in its repository.
   */
  public readonly number: number;

  /**
   * Makes a reference from its parts.
   *
   * @param host The id of the host module that reads the reference, which isn't blank.
   * @param owner The owner of the repository on the host: names of letters, digits, `.`, `_`, `-` and percent escapes such as `%20` but not of `/` or `\` joined by `/` for nested groups, none of them `.` or `..`, `%2e` counting as a dot.
   * @param repository The repository's name on the host: letters, digits, `.`, `_` and `-`, other than `.` and `..`.
   * @param number The issue's or pull request's number in its repository, a whole number above zero.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `number`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.number`.
   * @example
   * ```ts
   * import { HostReference } from "@noldova/git.hosting.protocol";
   *
   * const reference = new HostReference("git-github", "team", "repo", 7);
   * ```
   */
  public constructor(host: string, owner: string, repository: string, number: number, reader?: JsonReader);

  /**
   * The reference as a person writes it: the owner, a slash, the repository, a number sign and the number.
   *
   * @example
   * ```ts
   * import { HostReference } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostReference("git-github", "team", "repo", 7).text);
   * ```
   */
  public get text(): string;

  /**
   * Reads a reference from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The reference.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostReference } from "@noldova/git.hosting.protocol";
   *
   * const reference = HostReference.fromJson({ host: "git-github", owner: "team", repository: "repo", number: 7 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostReference;

  /**
   * Writes the reference as JSON: `host`, `owner`, `repository` and `number`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostReference } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostReference("git-github", "team", "repo", 7).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A person on a host, such as the author of a pull request or an issue: their login, their avatar and the name they show.
 *
 * @example
 * ```ts
 * import { HostPerson } from "@noldova/git.hosting.protocol";
 *
 * const person = new HostPerson("octocat", "data:image/png;base64,iVBORw0KGgo=", null);
 * console.log(person.login);
 * ```
 */
export declare class HostPerson {
  /**
   * The person's login on the host.
   */
  public readonly login: string;

  /**
   * The person's avatar as a base64 data address of a PNG, JPEG, GIF or WebP image of at most 64 KiB, which a window can show under a policy that
   * allows only its own and data images; null when the host gives none or the module couldn't read it.
   */
  public readonly avatar: string | null;

  /**
   * The person's profile page on the host, an https address as the host gives it, such as an app's page for an app; null when the host gives none.
   */
  public readonly url: string | null;

  /**
   * The name the person shows on the host, such as "Mona Lisa" for a login that is an email address; null when the host gives none, so a window shows the login.
   */
  public readonly name: string | null;

  /**
   * Makes a person from their parts.
   *
   * @param login The login, which isn't blank.
   * @param avatar The avatar as a base64 data address of a PNG, JPEG, GIF or WebP image of at most 64 KiB, or null.
   * @param url The profile page as an https address, or null.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @param name The name the person shows, which isn't blank, or null, the default.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `login`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.login`.
   * @example
   * ```ts
   * import { HostPerson } from "@noldova/git.hosting.protocol";
   *
   * const person = new HostPerson("monalisa", null, null);
   * const named = new HostPerson("monalisa@fabrikam.test", null, null, undefined, "Mona Lisa");
   * ```
   */
  public constructor(login: string, avatar: string | null, url: string | null, reader?: JsonReader, name?: string | null);

  /**
   * Reads a person from their JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The person.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPerson } from "@noldova/git.hosting.protocol";
   *
   * const person = HostPerson.fromJson({ login: "octocat", avatar: null, url: "https://github.com/octocat" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPerson;

  /**
   * Writes the person as JSON: `login`, `avatar` and `url`, each of the last two null when there is none, and `name` only when there is one.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostPerson } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostPerson("hubot", null, null).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What a pull request changes: its lines added and deleted, its files changed, its head and base branches and its head commit.
 *
 * @example
 * ```ts
 * import { HostChanges } from "@noldova/git.hosting.protocol";
 *
 * const changes = new HostChanges(12, 3, 2, "octocat/patch-1", "main", "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d");
 * console.log(changes.headBranch);
 * ```
 */
export declare class HostChanges {
  /**
   * The lines the pull request adds; zero when the host doesn't count them.
   */
  public readonly additions: number;

  /**
   * The lines the pull request deletes; zero when the host doesn't count them.
   */
  public readonly deletions: number;

  /**
   * The files the pull request changes; zero when the host doesn't count them.
   */
  public readonly changedFiles: number;

  /**
   * The branch whose changes the pull request brings.
   */
  public readonly headBranch: string;

  /**
   * The branch the pull request merges into.
   */
  public readonly baseBranch: string;

  /**
   * The head branch's commit the pull request shows, as a full hash.
   */
  public readonly headCommit: string;

  /**
   * Whether the host counts the lines and files; when it doesn't, the three counts are zero and show nothing.
   */
  public readonly isCounted: boolean;

  /**
   * Makes changes from their parts.
   *
   * @param additions The lines added, a whole number, zero or more.
   * @param deletions The lines deleted, a whole number, zero or more.
   * @param changedFiles The files changed, a whole number, zero or more.
   * @param headBranch The head branch, which isn't blank.
   * @param baseBranch The base branch, which isn't blank.
   * @param headCommit The head commit, a full hash of 40 or 64 lowercase hexadecimal digits.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @param isCounted Whether the host counts the lines and files, true by default; false needs the three counts at zero.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `headCommit`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.headCommit`.
   * @example
   * ```ts
   * import { HostChanges } from "@noldova/git.hosting.protocol";
   *
   * const changes = new HostChanges(0, 0, 0, "monalisa/fix", "main", "6dcb09b5b57875f334f61aebed695e2e4193db5e");
   * ```
   */
  public constructor(additions: number, deletions: number, changedFiles: number, headBranch: string, baseBranch: string, headCommit: string,
    reader?: JsonReader, isCounted?: boolean);

  /**
   * Makes changes whose host doesn't count the lines and files: their counts are zero, and `isCounted` is false.
   *
   * @param headBranch The head branch, which isn't blank.
   * @param baseBranch The base branch, which isn't blank.
   * @param headCommit The head commit, a full hash of 40 or 64 lowercase hexadecimal digits.
   * @returns The changes.
   * @throws {HostingArgumentException} When a part is out of its range, naming the parameter.
   * @example
   * ```ts
   * import { HostChanges } from "@noldova/git.hosting.protocol";
   *
   * const changes = HostChanges.uncounted("monalisa/fix", "main", "6dcb09b5b57875f334f61aebed695e2e4193db5e");
   * console.log(changes.isCounted);
   * ```
   */
  public static uncounted(headBranch: string, baseBranch: string, headCommit: string): HostChanges;

  /**
   * Reads changes from their JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The changes.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostChanges } from "@noldova/git.hosting.protocol";
   *
   * const changes = HostChanges.fromJson({
   *   additions: 12,
   *   deletions: 3,
   *   changedFiles: 2,
   *   headBranch: "octocat/patch-1",
   *   baseBranch: "main",
   *   headCommit: "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d"
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostChanges;

  /**
   * Writes the changes as JSON: `additions`, `deletions`, `changedFiles`, `headBranch`, `baseBranch` and `headCommit`, and `isCounted`, false, only for
   * changes the host doesn't count.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostChanges } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostChanges(12, 3, 2, "octocat/patch-1", "main", "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A pull request or an issue as its host shows it: its reference, kind, state, title, page, author, when it was opened and when it was merged or
 * closed, its comments and, for a pull request, its changes.
 *
 * @example
 * ```ts
 * import { HostItem, HostReference, ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
 *
 * const item = new HostItem(new HostReference("git-github", "octocat", "hello-world", 2), ReferenceKind.Issue, ReferenceState.Open,
 *   "Add a README", "https://github.com/octocat/hello-world/issues/2", null, 1_700_000_000_000, null, 0, null);
 * console.log(item.title);
 * ```
 */
export declare class HostItem {
  /**
   * The item's reference: its host module, repository and number.
   */
  public readonly reference: HostReference;

  /**
   * Whether the item is a pull request or an issue.
   */
  public readonly kind: ReferenceKind;

  /**
   * Where the item stands: `Open`, `Draft`, `Merged` or `Closed` for a pull request, and `Open`, `ClosedDone` or `ClosedNotPlanned` for an issue.
   */
  public readonly state: ReferenceState;

  /**
   * The item's title.
   */
  public readonly title: string;

  /**
   * The https address of the item's page on the host.
   */
  public readonly url: string;

  /**
   * The person who opened the item, or null when the host no longer knows them.
   */
  public readonly author: HostPerson | null;

  /**
   * When the item was opened, in milliseconds since the Unix epoch.
   */
  public readonly createdAt: number;

  /**
   * When a merged pull request was merged, or a closed pull request or issue was closed, in milliseconds since the Unix epoch; null while it's
   * open or a draft.
   */
  public readonly closedAt: number | null;

  /**
   * The comments on the item.
   */
  public readonly comments: number;

  /**
   * What the pull request changes, exactly for a pull request; null for an issue.
   */
  public readonly changes: HostChanges | null;

  /**
   * Makes an item from its parts.
   *
   * @param reference The reference.
   * @param kind The kind.
   * @param state The state, one of the kind's states.
   * @param title The title, which isn't blank.
   * @param url The page's https address, with no user name or password.
   * @param author The author, or null.
   * @param createdAt When it was opened, a whole number of milliseconds above zero.
   * @param closedAt When it was merged or closed, a whole number of milliseconds above zero, exactly when the state is neither Open nor Draft.
   * @param comments The comments, a whole number, zero or more.
   * @param changes The changes, exactly for a pull request.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range or doesn't fit the kind, naming the field as the parameter,
   * such as `changes`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range or doesn't fit the kind, naming the field by its path, such
   * as `$.changes`.
   * @example
   * ```ts
   * import { HostChanges, HostItem, HostPerson, HostReference, ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
   *
   * const item = new HostItem(new HostReference("git-github", "octocat", "hello-world", 1), ReferenceKind.PullRequest, ReferenceState.Open,
   *   "Fix the greeting", "https://github.com/octocat/hello-world/pull/1",
   *   new HostPerson("monalisa", null, null), 1_700_000_000_000, null, 2,
   *   new HostChanges(12, 3, 2, "monalisa/fix-greeting", "main", "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d"));
   * ```
   */
  public constructor(reference: HostReference, kind: ReferenceKind, state: ReferenceState, title: string, url: string, author: HostPerson | null,
    createdAt: number, closedAt: number | null, comments: number, changes: HostChanges | null, reader?: JsonReader);

  /**
   * Reads an item from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The item.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or the kind or state isn't one of its
   * names; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range or doesn't fit the kind.
   * @example
   * ```ts
   * import { HostItem } from "@noldova/git.hosting.protocol";
   *
   * const item = HostItem.fromJson({
   *   reference: { host: "git-github", owner: "octocat", repository: "hello-world", number: 2 },
   *   kind: "Issue",
   *   state: "ClosedDone",
   *   title: "Add a README",
   *   url: "https://github.com/octocat/hello-world/issues/2",
   *   author: { login: "hubot", avatar: null },
   *   createdAt: 1_700_000_000_000,
   *   closedAt: 1_700_000_360_000,
   *   comments: 1,
   *   changes: null
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostItem;

  /**
   * Writes the item as JSON: `reference`, `kind`, `state`, `title`, `url`, `author`, `createdAt`, `closedAt`, `comments` and `changes`, the
   * author, closing time and changes null when it has none.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostItem, HostReference, ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostItem(new HostReference("git-github", "octocat", "hello-world", 2), ReferenceKind.Issue, ReferenceState.Open,
   *   "Add a README", "https://github.com/octocat/hello-world/issues/2", null, 1_700_000_000_000, null, 0, null).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A check on a commit, such as a CI job: its name, where it stands and its page.
 *
 * @example
 * ```ts
 * import { CheckState, HostCheck } from "@noldova/git.hosting.protocol";
 *
 * const check = new HostCheck("build", CheckState.Succeeded, "https://github.com/octocat/hello-world/actions/runs/1");
 * console.log(check.state);
 * ```
 */
export declare class HostCheck {
  /**
   * The check's name on the host.
   */
  public readonly name: string;

  /**
   * Where the check stands.
   */
  public readonly state: CheckState;

  /**
   * The https address of the check's page on the host, or null when it has none.
   */
  public readonly url: string | null;

  /**
   * Makes a check from its parts.
   *
   * @param name The name, which isn't blank.
   * @param state Where it stands.
   * @param url The page's https address, with no user name or password, or null.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `url`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.url`.
   * @example
   * ```ts
   * import { CheckState, HostCheck } from "@noldova/git.hosting.protocol";
   *
   * const check = new HostCheck("lint", CheckState.Running, null);
   * ```
   */
  public constructor(name: string, state: CheckState, url: string | null, reader?: JsonReader);

  /**
   * Reads a check from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The check.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or the state isn't one of its names; it
   * comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostCheck } from "@noldova/git.hosting.protocol";
   *
   * const check = HostCheck.fromJson({ name: "build", state: "Failed", url: "https://github.com/octocat/hello-world/actions/runs/1" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostCheck;

  /**
   * Writes the check as JSON: `name`, `state` and `url`, null when it has none.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { CheckState, HostCheck } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostCheck("lint", CheckState.Queued, null).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A question for a commit author's picture on a host: the host, the repository's path, the author's email and a commit of theirs.
 *
 * @example
 * ```ts
 * import { AuthorQuery } from "@noldova/git.hosting.protocol";
 *
 * const query = new AuthorQuery("github.com", "octocat/hello-world", "octocat@github.com", "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d");
 * console.log(query.toJson());
 * ```
 */
export declare class AuthorQuery {
  /**
   * The host the repository is on, such as `github.com`.
   */
  public readonly host: string;

  /**
   * The repository's path on the host, such as `octocat/hello-world`.
   */
  public readonly path: string;

  /**
   * The author's email as the commit names it.
   */
  public readonly email: string;

  /**
   * A commit of the author's in the repository, as a full hash, for a host that finds people by commit.
   */
  public readonly commit: string;

  /**
   * Makes a query from its parts.
   *
   * @param host The host, which isn't blank.
   * @param path The repository's path: names of letters, digits, `.`, `_`, `-` and percent escapes such as `%20` but not of `/` or `\` joined by `/`, none of them `.` or `..`, `%2e` counting as a dot.
   * @param email The email, which isn't blank.
   * @param commit The commit, a full hash of 40 or 64 lowercase hexadecimal digits.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `commit`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.commit`.
   * @example
   * ```ts
   * import { AuthorQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = new AuthorQuery("github.com", "octocat/hello-world", "octocat@github.com", "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d");
   * ```
   */
  public constructor(host: string, path: string, email: string, commit: string, reader?: JsonReader);

  /**
   * Reads a query from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The query.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { AuthorQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = AuthorQuery.fromJson({ host: "github.com", path: "octocat/hello-world", email: "octocat@github.com", commit: "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): AuthorQuery;

  /**
   * Writes the query as JSON: `host`, `path`, `email` and `commit`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { AuthorQuery } from "@noldova/git.hosting.protocol";
   *
   * console.log(new AuthorQuery("github.com", "octocat/hello-world", "octocat@github.com", "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A question for a person's picture on a host: the host, the organization's path and the person's sign-in name, such as their email.
 *
 * @example
 * ```ts
 * import { PersonQuery } from "@noldova/git.hosting.protocol";
 *
 * const query = new PersonQuery("dev.azure.com", "fabrikam", "monalisa@fabrikam.test");
 * console.log(query.toJson());
 * ```
 */
export declare class PersonQuery {
  /**
   * The host the person is on, such as `dev.azure.com`.
   */
  public readonly host: string;

  /**
   * The organization's path on the host, such as `fabrikam`.
   */
  public readonly path: string;

  /**
   * The person's sign-in name on the host, as its work items and pull requests name them, such as their email.
   */
  public readonly login: string;

  /**
   * Makes a query from its parts.
   *
   * @param host The host, which isn't blank.
   * @param path The organization's path: names of letters, digits, `.`, `_`, `-` and percent escapes such as `%20` but not of `/` or `\` joined by `/`, none of them `.` or `..`, `%2e` counting as a dot.
   * @param login The person's sign-in name, which isn't blank.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `login`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.login`.
   * @example
   * ```ts
   * import { PersonQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = new PersonQuery("dev.azure.com", "fabrikam", "monalisa@fabrikam.test");
   * ```
   */
  public constructor(host: string, path: string, login: string, reader?: JsonReader);

  /**
   * Reads a query from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The query.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { PersonQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = PersonQuery.fromJson({ host: "dev.azure.com", path: "fabrikam", login: "monalisa@fabrikam.test" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PersonQuery;

  /**
   * Writes the query as JSON: `host`, `path` and `login`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { PersonQuery } from "@noldova/git.hosting.protocol";
   *
   * console.log(new PersonQuery("dev.azure.com", "fabrikam", "monalisa@fabrikam.test").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A commit author's picture on a host, or none.
 *
 * @example
 * ```ts
 * import { HostAvatar } from "@noldova/git.hosting.protocol";
 *
 * console.log(new HostAvatar(null).toJson());
 * ```
 */
export declare class HostAvatar {
  /**
   * The picture as a base64 data address of a PNG, JPEG, GIF or WebP image of at most 64 KiB, or null when the host has none.
   */
  public readonly avatar: string | null;

  /**
   * Makes an answer.
   *
   * @param avatar The picture as a base64 data address, or null.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when the picture isn't such an image's data address.
   * @throws {HostingFieldException} With a reader, when the picture isn't such an image's data address, naming `$.avatar`.
   * @example
   * ```ts
   * import { HostAvatar } from "@noldova/git.hosting.protocol";
   *
   * const answer = new HostAvatar("data:image/png;base64,iVBORw0KGgo=");
   * ```
   */
  public constructor(avatar: string | null, reader?: JsonReader);

  /**
   * Reads an answer from its JSON.
   *
   * @param value The JSON, with exactly the field `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The answer.
   * @throws {JsonException} When the value isn't an object, or the picture is missing or neither a text nor null; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or the picture is out of its range.
   * @example
   * ```ts
   * import { HostAvatar } from "@noldova/git.hosting.protocol";
   *
   * const answer = HostAvatar.fromJson({ avatar: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostAvatar;

  /**
   * Writes the answer as JSON: `avatar`, null when there is none.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostAvatar } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostAvatar(null).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A question for a branch's pull request on a host: the host, the repository's path, the branch and the commit whose checks to read.
 *
 * @example
 * ```ts
 * import { BranchQuery } from "@noldova/git.hosting.protocol";
 *
 * const query = new BranchQuery("github.com", "octocat/hello-world", "octocat/patch-1", "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d");
 * console.log(query.toJson());
 * ```
 */
export declare class BranchQuery {
  /**
   * The host the repository is on, such as `github.com`.
   */
  public readonly host: string;

  /**
   * The repository's path on the host, such as `octocat/hello-world`.
   */
  public readonly path: string;

  /**
   * The branch whose pull request to read.
   */
  public readonly branch: string;

  /**
   * The commit whose checks to read, as a full hash, or null for the pull request's own head.
   */
  public readonly headCommit: string | null;

  /**
   * Makes a query from its parts.
   *
   * @param host The host, which isn't blank.
   * @param path The repository's path: names of letters, digits, `.`, `_`, `-` and percent escapes such as `%20` but not of `/` or `\` joined by `/`, none of them `.` or `..`, `%2e` counting as a dot.
   * @param branch The branch, which isn't blank.
   * @param headCommit The commit, a full hash of 40 or 64 lowercase hexadecimal digits, or null.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `headCommit`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.headCommit`.
   * @example
   * ```ts
   * import { BranchQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = new BranchQuery("github.com", "octocat/hello-world", "monalisa/fix", null);
   * ```
   */
  public constructor(host: string, path: string, branch: string, headCommit: string | null, reader?: JsonReader);

  /**
   * Reads a query from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The query.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { BranchQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = BranchQuery.fromJson({ host: "github.com", path: "octocat/hello-world", branch: "octocat/patch-1", headCommit: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): BranchQuery;

  /**
   * Writes the query as JSON: `host`, `path`, `branch` and `headCommit`, null when there is none.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { BranchQuery } from "@noldova/git.hosting.protocol";
   *
   * console.log(new BranchQuery("github.com", "octocat/hello-world", "octocat/patch-1", null).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Which commit's pull request to read: the host, the repository's path on it and the commit.
 *
 * @example
 * ```ts
 * import { CommitQuery } from "@noldova/git.hosting.protocol";
 *
 * const query = new CommitQuery("dev.azure.com", "fabrikam/Web/_git/web", "6dcb09b5b57875f334f61aebed695e2e4193db5e");
 * console.log(query.toJson());
 * ```
 */
export declare class CommitQuery {
  /**
   * The host the repository is on, such as `dev.azure.com`.
   */
  public readonly host: string;

  /**
   * The repository's path on the host, such as `fabrikam/Web/_git/web`.
   */
  public readonly path: string;

  /**
   * The commit whose pull request to read, as a full hash.
   */
  public readonly commit: string;

  /**
   * Makes a query from its parts.
   *
   * @param host The host, which isn't blank.
   * @param path The repository's path: names of letters, digits, `.`, `_`, `-` and percent escapes such as `%20` but not of `/` or `\` joined by `/`, none of them `.` or `..`, `%2e` counting as a dot.
   * @param commit The commit, a full hash of 40 or 64 lowercase hexadecimal digits.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `commit`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.commit`.
   * @example
   * ```ts
   * import { CommitQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = new CommitQuery("github.com", "octocat/hello-world", "6dcb09b5b57875f334f61aebed695e2e4193db5e");
   * ```
   */
  public constructor(host: string, path: string, commit: string, reader?: JsonReader);

  /**
   * Reads a query from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The query.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { CommitQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = CommitQuery.fromJson({ host: "github.com", path: "octocat/hello-world", commit: "6dcb09b5b57875f334f61aebed695e2e4193db5e" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): CommitQuery;

  /**
   * Writes the query as JSON: `host`, `path` and `commit`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { CommitQuery } from "@noldova/git.hosting.protocol";
   *
   * console.log(new CommitQuery("github.com", "octocat/hello-world", "6dcb09b5b57875f334f61aebed695e2e4193db5e").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A branch's pull request on a host, or none, the checks on its commit and where its review stands.
 *
 * @example
 * ```ts
 * import type { BranchPullRequest } from "@noldova/git.hosting.protocol";
 *
 * function describe(answer: BranchPullRequest): string {
 *   return answer.pullRequest === null ? "no pull request" : `${answer.pullRequest.reference.text}: ${answer.checksState ?? "no checks"}`;
 * }
 * ```
 */
export declare class BranchPullRequest {
  /**
   * The branch's pull request, or null when it has none.
   */
  public readonly pullRequest: HostItem | null;

  /**
   * The checks on the commit, none when there is no pull request.
   */
  public readonly checks: readonly HostCheck[];

  /**
   * Where the pull request's review stands, or null when there is no pull request.
   */
  public readonly reviewDecision: ReviewDecision | null;

  /**
   * How many reviewers approve the pull request, or null when there is no pull request or the host doesn't count them.
   */
  public readonly approvals: number | null;

  /**
   * Makes an answer from its parts.
   *
   * @param pullRequest The pull request, an item of the kind `PullRequest`, or null.
   * @param checks The checks, none when the pull request is null.
   * @param reviewDecision Where the review stands, null exactly when the pull request is; `Waiting` for a pull request, and null without one, by default.
   * @param approvals How many reviewers approve, a whole number, zero or more, only with a pull request; null, by default, when the host doesn't count them.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when the item isn't a pull request, there are checks or approvals with no pull request,
   * the approvals are below zero, or the review decision is null for a pull request or set without one, naming the field as the parameter,
   * `pullRequest`, `checks`, `approvals` or `reviewDecision`.
   * @throws {HostingFieldException} With a reader, when the item isn't a pull request, there are checks or approvals with no pull request, the
   * approvals are below zero, or the review decision is null for a pull request or set without one, naming the field by its path, such as `$.checks`.
   * @example
   * ```ts
   * import { BranchPullRequest } from "@noldova/git.hosting.protocol";
   *
   * const none = new BranchPullRequest(null, []);
   * ```
   */
  public constructor(pullRequest: HostItem | null, checks: readonly HostCheck[], reviewDecision?: ReviewDecision | null, approvals?: number | null,
    reader?: JsonReader);

  /**
   * The worst state among the checks, in the order `Failed`, `Running`, `Queued`, `Succeeded` and `Neutral`, or null when there are no checks.
   *
   * @example
   * ```ts
   * import { type BranchPullRequest, CheckState } from "@noldova/git.hosting.protocol";
   *
   * function isFailing(answer: BranchPullRequest): boolean {
   *   return answer.checksState === CheckState.Failed;
   * }
   * ```
   */
  public get checksState(): CheckState | null;

  /**
   * Reads an answer from its JSON.
   *
   * @param value The JSON, with the fields `toJson` writes; without `reviewDecision`, as an older module answers, a pull request's review reads as
   * `Waiting`, and without `approvals` they read as null.
   * @param path The JSON's path, `$` by default.
   * @returns The answer.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or the review decision isn't one of
   * `ReviewDecision`'s; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, a field is out of its range, the item isn't a pull request,
   * there are checks or approvals with no pull request, the approvals are below zero, or the review decision is null for a pull request or set
   * without one.
   * @example
   * ```ts
   * import { BranchPullRequest } from "@noldova/git.hosting.protocol";
   *
   * const none = BranchPullRequest.fromJson({ pullRequest: null, checks: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): BranchPullRequest;

  /**
   * Writes the answer as JSON: `pullRequest`, null when there is none, `checks`, `reviewDecision`, null without a pull request, and `approvals`,
   * null when not counted.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { BranchPullRequest } from "@noldova/git.hosting.protocol";
   *
   * console.log(new BranchPullRequest(null, []).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A pull request to open on a host: the host, the repository's path, the head and base branches, the title, the body and whether it
 * opens as a draft.
 *
 * @example
 * ```ts
 * import { PullRequestDraft } from "@noldova/git.hosting.protocol";
 *
 * const draft = new PullRequestDraft("github.com", "octocat/hello-world", "octocat/patch-1", "main", "Fix the greeting", "", true);
 * console.log(draft.toJson());
 * ```
 */
export declare class PullRequestDraft {
  /**
   * The host the repository is on, such as `github.com`.
   */
  public readonly host: string;

  /**
   * The repository's path on the host, such as `octocat/hello-world`.
   */
  public readonly path: string;

  /**
   * The branch whose changes the pull request brings.
   */
  public readonly headBranch: string;

  /**
   * The branch the pull request merges into.
   */
  public readonly baseBranch: string;

  /**
   * The pull request's title.
   */
  public readonly title: string;

  /**
   * The pull request's description, which may be empty.
   */
  public readonly body: string;

  /**
   * Whether the pull request opens as a draft.
   */
  public readonly isDraft: boolean;

  /**
   * Makes a draft from its parts.
   *
   * @param host The host, which isn't blank.
   * @param path The repository's path: names of letters, digits, `.`, `_`, `-` and percent escapes such as `%20` but not of `/` or `\` joined by `/`, none of them `.` or `..`, `%2e` counting as a dot.
   * @param headBranch The head branch, which isn't blank.
   * @param baseBranch The base branch, which isn't blank and isn't the head branch.
   * @param title The title, which isn't blank.
   * @param body The description, any text.
   * @param isDraft Whether it opens as a draft.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range or the base branch is the head branch, naming the field as the
   * parameter, such as `baseBranch`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range or the base branch is the head branch, naming the field by
   * its path, such as `$.baseBranch`.
   * @example
   * ```ts
   * import { PullRequestDraft } from "@noldova/git.hosting.protocol";
   *
   * const draft = new PullRequestDraft("github.com", "octocat/hello-world", "monalisa/fix", "main", "Fix the greeting", "Closes #2.", false);
   * ```
   */
  public constructor(host: string, path: string, headBranch: string, baseBranch: string, title: string, body: string, isDraft: boolean,
    reader?: JsonReader);

  /**
   * Reads a draft from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The draft.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, a field is out of its range, or the base branch is the head branch.
   * @example
   * ```ts
   * import { PullRequestDraft } from "@noldova/git.hosting.protocol";
   *
   * const draft = PullRequestDraft.fromJson({
   *   host: "github.com",
   *   path: "octocat/hello-world",
   *   headBranch: "octocat/patch-1",
   *   baseBranch: "main",
   *   title: "Fix the greeting",
   *   body: "",
   *   isDraft: true
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PullRequestDraft;

  /**
   * Writes the draft as JSON: `host`, `path`, `headBranch`, `baseBranch`, `title`, `body` and `isDraft`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { PullRequestDraft } from "@noldova/git.hosting.protocol";
   *
   * console.log(new PullRequestDraft("github.com", "octocat/hello-world", "octocat/patch-1", "main", "Fix the greeting", "", true).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A work item to read from a host: the host module, the organization and the item's id, which is unique in the organization.
 *
 * @example
 * ```ts
 * import { WorkItemQuery } from "@noldova/git.hosting.protocol";
 *
 * const query = new WorkItemQuery("git-azure-devops", "fabrikam", 42);
 * console.log(query.toJson());
 * ```
 */
export declare class WorkItemQuery {
  /**
   * The host module's id, such as `git-azure-devops`.
   */
  public readonly host: string;

  /**
   * The organization the work item is in, such as `fabrikam`.
   */
  public readonly organization: string;

  /**
   * The work item's id.
   */
  public readonly id: number;

  /**
   * Makes a query from its parts.
   *
   * @param host The host module's id: letters, digits, `.`, `_` and `-`, other than `.` and `..`.
   * @param organization The organization: letters, digits, `.`, `_` and `-`, other than `.` and `..`.
   * @param id The work item's id, a whole number above zero.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `id`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.id`.
   * @example
   * ```ts
   * import { WorkItemQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = new WorkItemQuery("git-azure-devops", "fabrikam", 42);
   * ```
   */
  public constructor(host: string, organization: string, id: number, reader?: JsonReader);

  /**
   * Reads a query from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The query.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field or a field is out of its range.
   * @example
   * ```ts
   * import { WorkItemQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = WorkItemQuery.fromJson({ host: "git-azure-devops", organization: "fabrikam", id: 42 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WorkItemQuery;

  /**
   * Writes the query as JSON: `host`, `organization` and `id`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { WorkItemQuery } from "@noldova/git.hosting.protocol";
   *
   * console.log(new WorkItemQuery("git-azure-devops", "fabrikam", 42).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Work items to read from a host: the host module, the organization, the project, which items, and for the `Ids` scope, their ids.
 *
 * @example
 * ```ts
 * import { WorkItemScope, WorkItemsQuery } from "@noldova/git.hosting.protocol";
 *
 * const query = new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Mine, []);
 * console.log(query.toJson());
 * ```
 */
export declare class WorkItemsQuery {
  /**
   * The host module's id, such as `git-azure-devops`.
   */
  public readonly host: string;

  /**
   * The organization the project is in, such as `fabrikam`.
   */
  public readonly organization: string;

  /**
   * The project's name, such as `Web Site`.
   */
  public readonly project: string;

  /**
   * Which work items to read.
   */
  public readonly scope: WorkItemScope;

  /**
   * The work items' ids, each once, exactly for the `Ids` scope; empty otherwise.
   */
  public readonly ids: readonly number[];

  /**
   * Makes a query from its parts.
   *
   * @param host The host module's id: letters, digits, `.`, `_` and `-`, other than `.` and `..`.
   * @param organization The organization: letters, digits, `.`, `_` and `-`, other than `.` and `..`.
   * @param project The project's name, a text that isn't blank.
   * @param scope Which work items to read.
   * @param ids The work items' ids, whole numbers above zero, each once, exactly for the `Ids` scope; empty otherwise.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `ids`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.ids`.
   * @example
   * ```ts
   * import { WorkItemScope, WorkItemsQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Ids, [42, 43]);
   * ```
   */
  public constructor(host: string, organization: string, project: string, scope: WorkItemScope, ids: readonly number[], reader?: JsonReader);

  /**
   * Reads a query from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The query.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field or a field is out of its range.
   * @example
   * ```ts
   * import { WorkItemsQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = WorkItemsQuery.fromJson({ host: "git-azure-devops", organization: "fabrikam", project: "Web Site", scope: "Mine", ids: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WorkItemsQuery;

  /**
   * Writes the query as JSON: `host`, `organization`, `project`, `scope` and `ids`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { WorkItemScope, WorkItemsQuery } from "@noldova/git.hosting.protocol";
   *
   * console.log(new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Mine, []).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A change to a work item on a host: a new state, an assignment to the signed-in person, or both.
 *
 * @example
 * ```ts
 * import { WorkItemUpdate } from "@noldova/git.hosting.protocol";
 *
 * const update = new WorkItemUpdate("git-azure-devops", "fabrikam", 42, "Active", true);
 * console.log(update.toJson());
 * ```
 */
export declare class WorkItemUpdate {
  /**
   * The host module's id, such as `git-azure-devops`.
   */
  public readonly host: string;

  /**
   * The organization the work item is in, such as `fabrikam`.
   */
  public readonly organization: string;

  /**
   * The work item's id, unique in the organization.
   */
  public readonly id: number;

  /**
   * The state to move the work item to, as its process names it, such as `Active`, or null to leave it.
   */
  public readonly state: string | null;

  /**
   * Whether to assign the work item to the signed-in person.
   */
  public readonly assignToMe: boolean;

  /**
   * Makes an update from its parts.
   *
   * @param host The host module's id: letters, digits, `.`, `_` and `-`, other than `.` and `..`.
   * @param organization The organization: letters, digits, `.`, `_` and `-`, other than `.` and `..`.
   * @param id The work item's id, a whole number above zero.
   * @param state The new state, a text that isn't blank, or null to leave it; null needs `assignToMe`.
   * @param assignToMe Whether to assign the work item to the signed-in person.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range or the update changes nothing, naming the field as the
   * parameter, such as `state`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range or the update changes nothing, naming the field by its path,
   * such as `$.state`.
   * @example
   * ```ts
   * import { WorkItemUpdate } from "@noldova/git.hosting.protocol";
   *
   * const update = new WorkItemUpdate("git-azure-devops", "fabrikam", 42, null, true);
   * ```
   */
  public constructor(host: string, organization: string, id: number, state: string | null, assignToMe: boolean, reader?: JsonReader);

  /**
   * Reads an update from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The update.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, a field is out of its range or the update changes nothing.
   * @example
   * ```ts
   * import { WorkItemUpdate } from "@noldova/git.hosting.protocol";
   *
   * const update = WorkItemUpdate.fromJson({ host: "git-azure-devops", organization: "fabrikam", id: 42, state: "Active", assignToMe: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WorkItemUpdate;

  /**
   * Writes the update as JSON: `host`, `organization`, `id`, `state` and `assignToMe`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { WorkItemUpdate } from "@noldova/git.hosting.protocol";
   *
   * console.log(new WorkItemUpdate("git-azure-devops", "fabrikam", 42, "Active", true).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The work items a `WorkItemsQuery` answers, and whether its search stopped at the host's limit.
 *
 * @example
 * ```ts
 * import type { HostWorkItemList } from "@noldova/git.hosting.protocol";
 *
 * const countOf = (list: HostWorkItemList): string => `${list.items.length}${list.isTruncated ? "+" : ""}`;
 * ```
 */
export declare class HostWorkItemList {
  /**
   * The work items, each parent before its children, the ancestors the host adds to them included.
   */
  public readonly items: readonly HostWorkItemDetail[];

  /**
   * Whether the query's search found as many work items as the host reads at most, so there may be more; the ancestors added afterwards don't count.
   */
  public readonly isTruncated: boolean;

  /**
   * Makes a list from its parts.
   *
   * @param items The work items.
   * @param isTruncated Whether the search stopped at the host's limit.
   * @example
   * ```ts
   * import { HostWorkItemList } from "@noldova/git.hosting.protocol";
   *
   * const empty = new HostWorkItemList([], false);
   * ```
   */
  public constructor(items: readonly HostWorkItemDetail[], isTruncated: boolean);

  /**
   * Reads a list from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The list.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or an item is out of its range.
   * @example
   * ```ts
   * import { HostWorkItemList } from "@noldova/git.hosting.protocol";
   *
   * const list = HostWorkItemList.fromJson({ items: [], isTruncated: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostWorkItemList;

  /**
   * Writes the list as JSON: `items` and `isTruncated`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostWorkItemList } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostWorkItemList([], true).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A work item with what plans and tracks it: its points, its hours of work left and done, its order in the backlog, its acceptance criteria, its
 * children, the pull requests, commits and branches linked to it, and whether one of those pull requests waits on review.
 *
 * @example
 * ```ts
 * import { HostWorkItemDetail } from "@noldova/git.hosting.protocol";
 *
 * declare const item: import("@noldova/git.hosting.protocol").HostWorkItem;
 * const detail = new HostWorkItemDetail(item, 5, null, null, 1000, "Readers see a due date.", [7530, 7531], [], 5, ["users/kim/7521-export-notes"]);
 * console.log(detail.toJson());
 * ```
 */
export declare class HostWorkItemDetail {
  /**
   * The work item.
   */
  public readonly item: HostWorkItem;

  /**
   * The work item's story points or effort, or null when it has none.
   */
  public readonly points: number | null;

  /**
   * The hours of work left, or null when the host records none.
   */
  public readonly remaining: number | null;

  /**
   * The hours of work done, or null when the host records none.
   */
  public readonly completed: number | null;

  /**
   * The work item's place in its backlog, lower first, or null when it has none.
   */
  public readonly order: number | null;

  /**
   * The acceptance criteria as plain text, or null when it has none.
   */
  public readonly acceptance: string | null;

  /**
   * The ids of the work item's children, in the host's order.
   */
  public readonly children: readonly number[];

  /**
   * The pull requests linked to the work item.
   */
  public readonly pullRequests: readonly HostReference[];

  /**
   * How many commits are linked to the work item.
   */
  public readonly commits: number;

  /**
   * The names of the branches linked to the work item.
   */
  public readonly branches: readonly string[];

  /**
   * Whether one of the linked pull requests waits on review: it is active, and a reviewer voted to wait for its author or a required reviewer
   * hasn't approved it. False when none waits, a completed or abandoned pull request never waiting; null when that isn't known, such as when
   * the read didn't list the pull requests, or for a work item read alone. A host that knows it lists the waiting pull requests first.
   */
  public readonly isWaiting: boolean | null;

  /**
   * Makes a work item's detail from its parts.
   *
   * @param item The work item.
   * @param points The points, a number zero or more, or null.
   * @param remaining The hours left, a number zero or more, or null.
   * @param completed The hours done, a number zero or more, or null.
   * @param order The backlog order, a number, or null.
   * @param acceptance The acceptance criteria, a text that isn't blank, or null.
   * @param children The children's ids, whole numbers above zero, each once and none the work item itself.
   * @param pullRequests The linked pull requests.
   * @param commits How many commits are linked, a whole number, zero or more.
   * @param branches The linked branches' names, texts that aren't blank.
   * @param isWaiting Whether a linked pull request waits on review, or null, the default, when that isn't known.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `children`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.children`.
   * @example
   * ```ts
   * import { HostWorkItemDetail } from "@noldova/git.hosting.protocol";
   *
   * declare const item: import("@noldova/git.hosting.protocol").HostWorkItem;
   * const detail = new HostWorkItemDetail(item, null, 4, 2, null, null, [], [], 0, []);
   * ```
   */
  public constructor(item: HostWorkItem, points: number | null, remaining: number | null, completed: number | null, order: number | null,
    acceptance: string | null, children: readonly number[], pullRequests: readonly HostReference[], commits: number, branches: readonly string[],
    isWaiting?: boolean | null, reader?: JsonReader);

  /**
   * Reads a work item's detail from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The detail.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field or a field is out of its range.
   * @example
   * ```ts
   * import { HostWorkItemDetail } from "@noldova/git.hosting.protocol";
   *
   * declare const json: unknown;
   * const detail = HostWorkItemDetail.fromJson(json);
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostWorkItemDetail;

  /**
   * Writes the detail as JSON: `item`, `points`, `remaining`, `completed`, `order`, `acceptance`, `children`, `pullRequests`, `commits`,
   * `branches` and `isWaiting`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostWorkItemDetail } from "@noldova/git.hosting.protocol";
   *
   * declare const detail: HostWorkItemDetail;
   * console.log(detail.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What a host module can do, so a window shows only that.
 *
 * @example
 * ```ts
 * import { HostCapability } from "@noldova/git.hosting.protocol";
 *
 * console.log(HostCapability.Votes);
 * ```
 */
export declare const HostCapability: {
  /**
   * The person signs in to the host.
   */
  readonly SignIn: "SignIn";

  /**
   * The module reads an issue, a work item or a pull request by its reference.
   */
  readonly ReadItem: "ReadItem";

  /**
   * The module reads a branch's pull request.
   */
  readonly BranchPullRequest: "BranchPullRequest";

  /**
   * The person opens a pull request.
   */
  readonly CreatePullRequest: "CreatePullRequest";

  /**
   * A pull request shows the checks on its head commit.
   */
  readonly Checks: "Checks";

  /**
   * A pull request's reviewers vote.
   */
  readonly Votes: "Votes";

  /**
   * A pull request's branch policies hold it until they pass.
   */
  readonly Policies: "Policies";

  /**
   * A pull request shows the builds that ran for it.
   */
  readonly Builds: "Builds";

  /**
   * A pull request completes on its own once its policies pass.
   */
  readonly AutoComplete: "AutoComplete";

  /**
   * The host has work items with types, states, iterations and areas.
   */
  readonly WorkItems: "WorkItems";

  /**
   * The person makes a branch from a work item, linked to it.
   */
  readonly BranchFromItem: "BranchFromItem";

  /**
   * The host runs pipelines with stages and logs.
   */
  readonly Pipelines: "Pipelines";

  /**
   * The host shows commit authors' pictures.
   */
  readonly AuthorAvatars: "AuthorAvatars";

  /**
   * The host lists a repository's open pull requests.
   */
  readonly PullRequests: "PullRequests";
};

/**
 * The name of one of a host module's capabilities.
 */
export type HostCapability = (typeof HostCapability)[keyof typeof HostCapability];

/**
 * Where a pull request's branch policy stands.
 *
 * @example
 * ```ts
 * import { PolicyState } from "@noldova/git.hosting.protocol";
 *
 * console.log(PolicyState.Approved);
 * ```
 */
export declare const PolicyState: {
  /**
   * The policy waits to be checked.
   */
  readonly Queued: "Queued";

  /**
   * The policy is being checked, such as by a build.
   */
  readonly Running: "Running";

  /**
   * The policy passed.
   */
  readonly Approved: "Approved";

  /**
   * The policy failed.
   */
  readonly Rejected: "Rejected";

  /**
   * The policy doesn't apply to this pull request.
   */
  readonly NotApplicable: "NotApplicable";
};

/**
 * The name of a branch policy's state.
 */
export type PolicyState = (typeof PolicyState)[keyof typeof PolicyState];

/**
 * The category a work item's state belongs to, whatever the host's process names the state.
 *
 * @example
 * ```ts
 * import { WorkItemCategory } from "@noldova/git.hosting.protocol";
 *
 * console.log(WorkItemCategory.InProgress);
 * ```
 */
export declare const WorkItemCategory: {
  /**
   * The work is proposed and not started.
   */
  readonly Proposed: "Proposed";

  /**
   * The work is under way.
   */
  readonly InProgress: "InProgress";

  /**
   * The work is done and waits to be confirmed.
   */
  readonly Resolved: "Resolved";

  /**
   * The work is done.
   */
  readonly Completed: "Completed";

  /**
   * The work was dropped.
   */
  readonly Removed: "Removed";
};

/**
 * The name of a work item state's category.
 */
export type WorkItemCategory = (typeof WorkItemCategory)[keyof typeof WorkItemCategory];

/**
 * Which work items a `WorkItemsQuery` reads.
 *
 * @example
 * ```ts
 * import { WorkItemScope } from "@noldova/git.hosting.protocol";
 *
 * console.log(WorkItemScope.Mine);
 * ```
 */
export declare const WorkItemScope: {
  /**
   * The work items assigned to the signed-in person that aren't closed, with their ancestors, so the hierarchy reads.
   */
  readonly Mine: "Mine";

  /**
   * The work items with the query's ids.
   */
  readonly Ids: "Ids";
};

/**
 * The name of a work item scope.
 */
export type WorkItemScope = (typeof WorkItemScope)[keyof typeof WorkItemScope];

/**
 * Where a pull request's comment thread stands.
 *
 * @example
 * ```ts
 * import { ThreadStatus } from "@noldova/git.hosting.protocol";
 *
 * console.log(ThreadStatus.Resolved);
 * ```
 */
export declare const ThreadStatus: {
  /**
   * The thread waits for an answer or a change.
   */
  readonly Active: "Active";

  /**
   * The thread waits on something its author named.
   */
  readonly Pending: "Pending";

  /**
   * The thread's point was fixed.
   */
  readonly Resolved: "Resolved";

  /**
   * The thread's point won't be fixed.
   */
  readonly WontFix: "WontFix";

  /**
   * The thread's point is the intended behavior.
   */
  readonly ByDesign: "ByDesign";

  /**
   * The thread was closed with no outcome.
   */
  readonly Closed: "Closed";

  /**
   * The host keeps no state for the thread.
   */
  readonly None: "None";
};

/**
 * The name of a thread's state.
 */
export type ThreadStatus = (typeof ThreadStatus)[keyof typeof ThreadStatus];

/**
 * The capabilities a host module has, each at most once.
 *
 * @example
 * ```ts
 * import { HostCapabilities, HostCapability } from "@noldova/git.hosting.protocol";
 *
 * const capabilities = new HostCapabilities([HostCapability.SignIn, HostCapability.Votes]);
 * console.log(capabilities.has(HostCapability.Votes));
 * ```
 */
export declare class HostCapabilities {
  /**
   * The capabilities, in the order given.
   */
  public readonly capabilities: readonly HostCapability[];

  /**
   * Makes the capabilities from a list, which it copies.
   *
   * @param capabilities The capabilities, each at most once.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a capability is named twice, naming `capabilities`.
   * @throws {HostingFieldException} With a reader, when a capability is named twice, naming `$.capabilities`.
   * @example
   * ```ts
   * import { HostCapabilities, HostCapability } from "@noldova/git.hosting.protocol";
   *
   * const capabilities = new HostCapabilities([HostCapability.Builds]);
   * ```
   */
  public constructor(capabilities: readonly HostCapability[], reader?: JsonReader);

  /**
   * Tells whether the host has a capability.
   *
   * @param capability The capability.
   * @returns Whether the list holds it.
   * @example
   * ```ts
   * import { HostCapabilities, HostCapability } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostCapabilities([]).has(HostCapability.Pipelines));
   * ```
   */
  public has(capability: HostCapability): boolean;

  /**
   * Reads the capabilities from their JSON.
   *
   * @param value The JSON, with exactly the field `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The capabilities.
   * @throws {JsonException} When the value isn't an object or `capabilities` isn't a list of texts; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a capability is unknown or named twice.
   * @example
   * ```ts
   * import { HostCapabilities } from "@noldova/git.hosting.protocol";
   *
   * const capabilities = HostCapabilities.fromJson({ capabilities: ["SignIn"] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostCapabilities;

  /**
   * Writes the capabilities as JSON: `capabilities`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostCapabilities, HostCapability } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostCapabilities([HostCapability.SignIn]).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A pull request's reviewer and their vote.
 *
 * @example
 * ```ts
 * import { HostPerson, HostReviewer } from "@noldova/git.hosting.protocol";
 *
 * const reviewer = new HostReviewer(new HostPerson("monalisa", null, null), 1, "Approved", true);
 * console.log(reviewer.voteLabel);
 * ```
 */
export declare class HostReviewer {
  /**
   * The reviewer.
   */
  public readonly person: HostPerson;

  /**
   * The vote from -1, rejected, through 0, no vote, to 1, approved; a host with more steps places them between.
   */
  public readonly vote: number;

  /**
   * The vote in the host's own words.
   */
  public readonly voteLabel: string;

  /**
   * Whether the pull request needs this reviewer.
   */
  public readonly isRequired: boolean;

  /**
   * Makes a reviewer from its parts.
   *
   * @param person The reviewer.
   * @param vote The vote, from -1 to 1.
   * @param voteLabel The vote in the host's words, which isn't blank.
   * @param isRequired Whether the pull request needs the reviewer.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `vote`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.vote`.
   * @example
   * ```ts
   * import { HostPerson, HostReviewer } from "@noldova/git.hosting.protocol";
   *
   * const reviewer = new HostReviewer(new HostPerson("octocat", null, null), 0.5, "Approved with suggestions", false);
   * ```
   */
  public constructor(person: HostPerson, vote: number, voteLabel: string, isRequired: boolean, reader?: JsonReader);

  /**
   * Reads a reviewer from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The reviewer.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostReviewer } from "@noldova/git.hosting.protocol";
   *
   * const reviewer = HostReviewer.fromJson({ person: { login: "monalisa", avatar: null, url: null }, vote: 0, voteLabel: "No vote", isRequired: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostReviewer;

  /**
   * Writes the reviewer as JSON: `person`, `vote`, `voteLabel` and `isRequired`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostPerson, HostReviewer } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostReviewer(new HostPerson("monalisa", null, null), -1, "Rejected", false).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A branch policy on a pull request: its name, where it stands and whether it holds the pull request.
 *
 * @example
 * ```ts
 * import { HostPolicy, PolicyState } from "@noldova/git.hosting.protocol";
 *
 * const policy = new HostPolicy("Minimum number of reviewers", PolicyState.Approved, true, null);
 * console.log(policy.state);
 * ```
 */
export declare class HostPolicy {
  /**
   * The policy's name on the host.
   */
  public readonly name: string;

  /**
   * Where the policy stands.
   */
  public readonly state: PolicyState;

  /**
   * Whether the pull request can't complete until the policy passes.
   */
  public readonly isBlocking: boolean;

  /**
   * The https address of the policy's page on the host, or null when it has none.
   */
  public readonly url: string | null;

  /**
   * For a build policy, the number of the build it ran, such as "20261121.4"; null for another policy, or when the host doesn't give it.
   */
  public readonly buildNumber: string | null;

  /**
   * Makes a policy from its parts.
   *
   * @param name The name, which isn't blank.
   * @param state Where it stands.
   * @param isBlocking Whether it holds the pull request.
   * @param url The page's https address, with no user name or password, or null.
   * @param buildNumber The number of the build a build policy ran, which isn't blank; null, by default, for another policy or when the host doesn't give it.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `url`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.url`.
   * @example
   * ```ts
   * import { HostPolicy, PolicyState } from "@noldova/git.hosting.protocol";
   *
   * const policy = new HostPolicy("Build", PolicyState.Running, true, null);
   * ```
   */
  public constructor(name: string, state: PolicyState, isBlocking: boolean, url: string | null, buildNumber?: string | null, reader?: JsonReader);

  /**
   * Reads a policy from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes; without `buildNumber`, it reads as null.
   * @param path The JSON's path, `$` by default.
   * @returns The policy.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or the state isn't one of its names; it
   * comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPolicy } from "@noldova/git.hosting.protocol";
   *
   * const policy = HostPolicy.fromJson({ name: "Build", state: "Queued", isBlocking: true, url: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPolicy;

  /**
   * Writes the policy as JSON: `name`, `state`, `isBlocking`, `url` and `buildNumber`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostPolicy, PolicyState } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostPolicy("Build", PolicyState.Rejected, true, null).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A build that ran for a pull request or a commit: its name, where it stands, its page and its times.
 *
 * @example
 * ```ts
 * import { CheckState, HostBuild } from "@noldova/git.hosting.protocol";
 *
 * const build = new HostBuild("web-ci", CheckState.Running, null, 1_800_000_000_000, null);
 * console.log(build.state);
 * ```
 */
export declare class HostBuild {
  /**
   * The build's name on the host, such as its pipeline's.
   */
  public readonly name: string;

  /**
   * Where the build stands.
   */
  public readonly state: CheckState;

  /**
   * The https address of the build's page on the host, or null when it has none.
   */
  public readonly url: string | null;

  /**
   * When the build started, in milliseconds since 1970 UTC, or null when it hasn't.
   */
  public readonly startedAt: number | null;

  /**
   * When the build finished, in milliseconds since 1970 UTC, exactly when it succeeded, failed or ended neutral.
   */
  public readonly finishedAt: number | null;

  /**
   * The build's number on the host, such as "20261121.4", or null when the host doesn't give one.
   */
  public readonly number: string | null;

  /**
   * Makes a build from its parts.
   *
   * @param name The name, which isn't blank.
   * @param state Where it stands.
   * @param url The page's https address, with no user name or password, or null.
   * @param startedAt When it started, above zero, or null.
   * @param finishedAt When it finished, above zero and no earlier than its start, exactly when the state is `Succeeded`, `Failed` or `Neutral`.
   * @param number The build's number, which isn't blank; null, by default, when the host doesn't give one.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `finishedAt`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.finishedAt`.
   * @example
   * ```ts
   * import { CheckState, HostBuild } from "@noldova/git.hosting.protocol";
   *
   * const build = new HostBuild("web-ci", CheckState.Succeeded, null, 1_800_000_000_000, 1_800_000_060_000);
   * ```
   */
  public constructor(name: string, state: CheckState, url: string | null, startedAt: number | null, finishedAt: number | null, number?: string | null,
    reader?: JsonReader);

  /**
   * Reads a build from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes; without `number`, it reads as null.
   * @param path The JSON's path, `$` by default.
   * @returns The build.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or the state isn't one of its names; it
   * comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostBuild } from "@noldova/git.hosting.protocol";
   *
   * const build = HostBuild.fromJson({ name: "web-ci", state: "Queued", url: null, startedAt: null, finishedAt: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostBuild;

  /**
   * Writes the build as JSON: `name`, `state`, `url`, `startedAt`, `finishedAt` and `number`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { CheckState, HostBuild } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostBuild("web-ci", CheckState.Queued, null, null, null).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A pull request with its reviewers and their votes, its branch policies and its builds.
 *
 * @example
 * ```ts
 * import { HostPullRequest } from "@noldova/git.hosting.protocol";
 *
 * declare const pullRequest: HostPullRequest;
 * console.log(pullRequest.reviewers.length);
 * ```
 */
export declare class HostPullRequest {
  /**
   * The pull request itself.
   */
  public readonly item: HostItem;

  /**
   * Its reviewers, in the host's order.
   */
  public readonly reviewers: readonly HostReviewer[];

  /**
   * Its branch policies, in the host's order.
   */
  public readonly policies: readonly HostPolicy[];

  /**
   * The builds that ran for it, in the host's order.
   */
  public readonly builds: readonly HostBuild[];

  /**
   * Whether it completes on its own once its policies pass.
   */
  public readonly isAutoComplete: boolean;

  /**
   * Its description as the author wrote it, in Markdown; empty when it has none.
   */
  public readonly description: string;

  /**
   * How many commits it has, or null when the host can't say, such as for 100 or more.
   */
  public readonly commitCount: number | null;

  /**
   * The work items linked to it.
   */
  public readonly workItems: readonly HostWorkItemLink[];

  /**
   * The merge type auto-complete is set to complete it with, as the host names it, such as Azure DevOps' `squash`; null when auto-complete isn't set or
   * the host doesn't say.
   */
  public readonly autoCompleteMergeType: string | null;

  /**
   * Whether it conflicts with its target branch, so it can't merge until the conflicts are resolved; null when the host doesn't say.
   */
  public readonly hasConflicts: boolean | null;

  /**
   * Makes a pull request from its parts, copying the lists.
   *
   * @param item The pull request, of the kind `PullRequest`.
   * @param reviewers Its reviewers.
   * @param policies Its branch policies.
   * @param builds Its builds.
   * @param isAutoComplete Whether it completes on its own.
   * @param description Its description in Markdown, empty when it has none.
   * @param commitCount How many commits it has, zero or more, or null when the host can't say.
   * @param workItems The work items linked to it.
   * @param autoCompleteMergeType The merge type auto-complete is set to complete it with, not blank, or null, the default, when it isn't set or the host
   * doesn't say.
   * @param hasConflicts Whether it conflicts with its target branch, or null, the default, when the host doesn't say.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when the item isn't a pull request, naming `item`, the commit count is out of its range,
   * naming `commitCount`, or the auto-complete merge type is blank, naming `autoCompleteMergeType`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.item`.
   * @example
   * ```ts
   * import { HostItem, HostPullRequest } from "@noldova/git.hosting.protocol";
   *
   * declare const item: HostItem;
   * const pullRequest = new HostPullRequest(item, [], [], [], false, "", null, []);
   * ```
   */
  public constructor(item: HostItem, reviewers: readonly HostReviewer[], policies: readonly HostPolicy[], builds: readonly HostBuild[],
    isAutoComplete: boolean, description: string, commitCount: number | null, workItems: readonly HostWorkItemLink[], autoCompleteMergeType?: string | null,
    hasConflicts?: boolean | null, reader?: JsonReader);

  /**
   * Reads a pull request from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The pull request.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, a field is out of its range, or the item isn't a pull request.
   * @example
   * ```ts
   * import { HostPullRequest } from "@noldova/git.hosting.protocol";
   *
   * declare const json: unknown;
   * const pullRequest = HostPullRequest.fromJson(json);
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequest;

  /**
   * Writes the pull request as JSON: `item`, `reviewers`, `policies`, `builds`, `isAutoComplete`, `description`, `commitCount` and `workItems`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostPullRequest } from "@noldova/git.hosting.protocol";
   *
   * declare const pullRequest: HostPullRequest;
   * console.log(pullRequest.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A work item linked to a pull request: its id, title, type, state, the state's category and page.
 *
 * @example
 * ```ts
 * import { HostWorkItemLink, HostWorkItemType, WorkItemCategory } from "@noldova/git.hosting.protocol";
 *
 * const link = new HostWorkItemLink(7521, "Export notes as Markdown files", new HostWorkItemType("User Story", "009CCC", "icon_book"), "Active",
 *   WorkItemCategory.InProgress, "https://dev.azure.com/fabrikam/_workitems/edit/7521");
 * ```
 */
export declare class HostWorkItemLink {
  /**
   * The work item's id.
   */
  public readonly id: number;

  /**
   * The work item's title.
   */
  public readonly title: string;

  /**
   * The work item's type as the host draws it.
   */
  public readonly type: HostWorkItemType;

  /**
   * The work item's state, as the host names it, such as `Active`.
   */
  public readonly state: string;

  /**
   * The category the state belongs to.
   */
  public readonly category: WorkItemCategory;

  /**
   * The work item's page, an https address.
   */
  public readonly url: string;

  /**
   * Makes a link from its parts.
   *
   * @param id The id, one or more.
   * @param title The title, which isn't blank.
   * @param type The type.
   * @param state The state, which isn't blank.
   * @param category The state's category.
   * @param url The page, an https address with no user name or password.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `id`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.workItems.0.id`.
   * @example
   * ```ts
   * import { HostWorkItemLink, HostWorkItemType, WorkItemCategory } from "@noldova/git.hosting.protocol";
   *
   * const link = new HostWorkItemLink(7499, "Due dates ignore local times", new HostWorkItemType("Bug", "CC293D", "icon_insect"), "Active",
   *   WorkItemCategory.InProgress, "https://dev.azure.com/fabrikam/_workitems/edit/7499");
   * ```
   */
  public constructor(id: number, title: string, type: HostWorkItemType, state: string, category: WorkItemCategory, url: string, reader?: JsonReader);

  /**
   * Reads a link from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The link.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostWorkItemLink } from "@noldova/git.hosting.protocol";
   *
   * const link = HostWorkItemLink.fromJson({ id: 7521, title: "Export notes as Markdown files",
   *   type: { name: "User Story", color: "009CCC", icon: "icon_book" }, state: "Active", category: "InProgress",
   *   url: "https://dev.azure.com/fabrikam/_workitems/edit/7521" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostWorkItemLink;

  /**
   * Writes the link as JSON: `id`, `title`, `type`, `state`, `category` and `url`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostWorkItemLink } from "@noldova/git.hosting.protocol";
   *
   * const send = (link: HostWorkItemLink): string => JSON.stringify(link.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A comment in a pull request's thread: its id, the comment it answers, its author, when it was published and its Markdown text.
 *
 * @example
 * ```ts
 * import { HostComment, HostPerson } from "@noldova/git.hosting.protocol";
 *
 * const comment = new HostComment(1, null, new HostPerson("monalisa@fabrikam.test", null, null), 1_800_000_000_000, "Should this respect local times?");
 * ```
 */
export declare class HostComment {
  /**
   * The comment's id within its thread.
   */
  public readonly id: number;

  /**
   * The id of the comment this one answers, or null for a comment that starts the thread or answers none.
   */
  public readonly parent: number | null;

  /**
   * The comment's author.
   */
  public readonly author: HostPerson;

  /**
   * When the comment was published, in milliseconds since 1970 in UTC.
   */
  public readonly publishedAt: number;

  /**
   * The comment's text, in Markdown.
   */
  public readonly body: string;

  /**
   * Makes a comment from its parts.
   *
   * @param id The id, one or more.
   * @param parent The id of the comment it answers, one or more and not its own, or null.
   * @param author The author.
   * @param publishedAt When it was published, one or more.
   * @param body The Markdown text, which isn't blank.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `parent`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.comments.1.parent`.
   * @example
   * ```ts
   * import { HostComment, HostPerson } from "@noldova/git.hosting.protocol";
   *
   * const reply = new HostComment(2, 1, new HostPerson("octocat@fabrikam.test", null, null), 1_800_000_060_000, "Yes, fixed.");
   * ```
   */
  public constructor(id: number, parent: number | null, author: HostPerson, publishedAt: number, body: string, reader?: JsonReader);

  /**
   * Reads a comment from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The comment.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostComment } from "@noldova/git.hosting.protocol";
   *
   * const comment = HostComment.fromJson({ id: 1, parent: null, author: { login: "monalisa@fabrikam.test", avatar: null, url: null },
   *   publishedAt: 1_800_000_000_000, body: "Should this respect local times?" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostComment;

  /**
   * Writes the comment as JSON: `id`, `parent`, `author`, `publishedAt` and `body`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostComment } from "@noldova/git.hosting.protocol";
   *
   * const send = (comment: HostComment): string => JSON.stringify(comment.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A pull request's comment thread: its id, its state, the file and line it is on, and its comments, oldest first.
 *
 * @example
 * ```ts
 * import { HostComment, HostPerson, HostThread, ThreadStatus } from "@noldova/git.hosting.protocol";
 *
 * const thread = new HostThread(7, ThreadStatus.Active, "/src/notes-export.ts", 42,
 *   [new HostComment(1, null, new HostPerson("monalisa@fabrikam.test", null, null), 1_800_000_000_000, "Should this respect local times?")]);
 * ```
 */
export declare class HostThread {
  /**
   * The thread's id, unique within its pull request. A host that numbers its kinds of comments apart, such as GitHub's conversation and review comments,
   * makes it from the kind and the first comment's id, so it may differ from every comment's own id.
   */
  public readonly id: number;

  /**
   * The thread's state.
   */
  public readonly state: ThreadStatus;

  /**
   * The file the thread is on, as the host writes its path, or null for a thread on the whole pull request.
   */
  public readonly path: string | null;

  /**
   * The line the thread is on, counted from one, or null for a thread on the whole file or the whole pull request.
   */
  public readonly line: number | null;

  /**
   * The thread's comments, oldest first, at least one.
   */
  public readonly comments: readonly HostComment[];

  /**
   * Makes a thread from its parts, keeping its own copy of the comments.
   *
   * @param id The id, one or more.
   * @param state The state.
   * @param path The file, which isn't blank, or null.
   * @param line The line, one or more and only with a file, or null.
   * @param comments The comments, at least one.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `line`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.0.line`.
   * @example
   * ```ts
   * import { HostComment, HostPerson, HostThread, ThreadStatus } from "@noldova/git.hosting.protocol";
   *
   * const thread = new HostThread(8, ThreadStatus.Resolved, null, null,
   *   [new HostComment(1, null, new HostPerson("octocat@fabrikam.test", null, null), 1_800_000_000_000, "Ready once CI passes.")]);
   * ```
   */
  public constructor(id: number, state: ThreadStatus, path: string | null, line: number | null, comments: readonly HostComment[], reader?: JsonReader);

  /**
   * Reads a thread from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The thread.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or the state is unknown; it comes from
   * `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostThread } from "@noldova/git.hosting.protocol";
   *
   * const thread = HostThread.fromJson({ id: 8, state: "Active", path: null, line: null, comments: [{ id: 1, parent: null,
   *   author: { login: "octocat@fabrikam.test", avatar: null, url: null }, publishedAt: 1_800_000_000_000, body: "Ready once CI passes." }] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostThread;

  /**
   * Writes the thread as JSON: `id`, `state`, `path`, `line` and `comments`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostThread } from "@noldova/git.hosting.protocol";
   *
   * const send = (threads: readonly HostThread[]): string => JSON.stringify(threads.map(t => t.toJson()));
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A work item type as the host draws it: its name, color and icon.
 *
 * @example
 * ```ts
 * import { HostWorkItemType } from "@noldova/git.hosting.protocol";
 *
 * const type = new HostWorkItemType("User Story", "009CCC", "icon_book");
 * console.log(type.color);
 * ```
 */
export declare class HostWorkItemType {
  /**
   * The type's name in the host's process, such as `User Story`.
   */
  public readonly name: string;

  /**
   * The type's color, six hexadecimal digits without `#`.
   */
  public readonly color: string;

  /**
   * The name of the type's icon on the host, which a host module's window maps to its own icon when the type has no image.
   */
  public readonly icon: string;

  /**
   * The icon as the host draws it, SVG markup in the type's color, or null when the host gave none; a window shows it only as an image, where it runs no
   * script and loads nothing. JSON without the field reads as null.
   */
  public readonly image: string | null;

  /**
   * Makes a work item type from its parts.
   *
   * @param name The name, which isn't blank.
   * @param color Six hexadecimal digits.
   * @param icon A name of letters, digits, `.`, `_` and `-`.
   * @param image SVG markup of at most 65536 characters, which may start with an XML declaration, or null, the default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `color`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.color`.
   * @example
   * ```ts
   * import { HostWorkItemType } from "@noldova/git.hosting.protocol";
   *
   * const type = new HostWorkItemType("Bug", "CC293D", "icon_insect");
   * ```
   */
  public constructor(name: string, color: string, icon: string, image?: string | null, reader?: JsonReader);

  /**
   * Reads a work item type from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The type.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostWorkItemType } from "@noldova/git.hosting.protocol";
   *
   * const type = HostWorkItemType.fromJson({ name: "Task", color: "F2CB1D", icon: "icon_clipboard" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostWorkItemType;

  /**
   * Writes the type as JSON: `name`, `color` and `icon`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostWorkItemType } from "@noldova/git.hosting.protocol";
   *
   * console.log(new HostWorkItemType("Task", "F2CB1D", "icon_clipboard").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A work item on a host: where it lives, its type, title, state and category, who has it, and where it sits in the plan.
 *
 * @example
 * ```ts
 * import { HostWorkItem } from "@noldova/git.hosting.protocol";
 *
 * declare const item: HostWorkItem;
 * console.log(`${item.type.name} ${item.id}: ${item.title}`);
 * ```
 */
export declare class HostWorkItem {
  /**
   * The host module's id, such as `git-azure-devops`.
   */
  public readonly host: string;

  /**
   * The organization that holds the item.
   */
  public readonly organization: string;

  /**
   * The project that holds the item, as the host names it.
   */
  public readonly project: string;

  /**
   * The item's number, unique in the organization.
   */
  public readonly id: number;

  /**
   * The item's type.
   */
  public readonly type: HostWorkItemType;

  /**
   * The item's title.
   */
  public readonly title: string;

  /**
   * The item's state in the host's process, such as `Active`.
   */
  public readonly state: string;

  /**
   * The category the state belongs to.
   */
  public readonly category: WorkItemCategory;

  /**
   * The https address of the item's page.
   */
  public readonly url: string;

  /**
   * Who the item is assigned to, or null.
   */
  public readonly assignee: HostPerson | null;

  /**
   * The item's iteration path, or null.
   */
  public readonly iteration: string | null;

  /**
   * The item's area path, or null.
   */
  public readonly area: string | null;

  /**
   * The parent item's number, or null.
   */
  public readonly parent: number | null;

  /**
   * When the item last changed, in milliseconds since 1970 UTC, or null when the host didn't say; JSON without the field reads as null.
   */
  public readonly changedAt: number | null;

  /**
   * Makes a work item from its parts.
   *
   * @param host The host module's id, a name of letters, digits, `.`, `_` and `-`.
   * @param organization The organization, a name of the same characters.
   * @param project The project, which isn't blank.
   * @param id The number, above zero.
   * @param type The type.
   * @param title The title, which isn't blank.
   * @param state The state, which isn't blank.
   * @param category The state's category.
   * @param url The page's https address, with no user name or password.
   * @param assignee The assignee, or null.
   * @param iteration The iteration path, which isn't blank, or null.
   * @param area The area path, which isn't blank, or null.
   * @param parent The parent's number, above zero and not the item's own, or null.
   * @param changedAt When it last changed, in milliseconds since 1970 UTC and above zero, or null, the default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `parent`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.parent`.
   * @example
   * ```ts
   * import { HostWorkItem, HostWorkItemType, WorkItemCategory } from "@noldova/git.hosting.protocol";
   *
   * const item = new HostWorkItem("git-azure-devops", "fabrikam", "Web Site", 42, new HostWorkItemType("Bug", "CC293D", "icon_insect"),
   *   "The sign-in page loops", "New", WorkItemCategory.Proposed, "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/42", null, null, null, null);
   * ```
   */
  public constructor(host: string, organization: string, project: string, id: number, type: HostWorkItemType, title: string, state: string,
    category: WorkItemCategory, url: string, assignee: HostPerson | null, iteration: string | null, area: string | null, parent: number | null,
    changedAt?: number | null, reader?: JsonReader);

  /**
   * Reads a work item from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The work item.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or the category isn't one of its names; it
   * comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostWorkItem } from "@noldova/git.hosting.protocol";
   *
   * declare const json: unknown;
   * const item = HostWorkItem.fromJson(json);
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostWorkItem;

  /**
   * Writes the work item as JSON: `host`, `organization`, `project`, `id`, `type`, `title`, `state`, `category`, `url`, `assignee`, `iteration`,
   * `area` and `parent`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostWorkItem } from "@noldova/git.hosting.protocol";
   *
   * declare const item: HostWorkItem;
   * console.log(item.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Where a pull request's checks stand, the worst of them first.
 *
 * @example
 * ```ts
 * import { PullRequestStatus } from "@noldova/git.hosting.protocol";
 *
 * const isRed = (status: PullRequestStatus): boolean => status === PullRequestStatus.Failed;
 * ```
 */
export declare const PullRequestStatus: {
  /**
   * A check failed.
   */
  readonly Failed: "Failed";

  /**
   * None failed, and a check runs or waits.
   */
  readonly Pending: "Pending";

  /**
   * Every check passed.
   */
  readonly Succeeded: "Succeeded";

  /**
   * The pull request has no checks.
   */
  readonly None: "None";
};

/**
 * Where a pull request's checks stand.
 */
export type PullRequestStatus = (typeof PullRequestStatus)[keyof typeof PullRequestStatus];

/**
 * A repository on a host, as a read of its pull requests names it.
 *
 * @example
 * ```ts
 * import { RepositoryQuery } from "@noldova/git.hosting.protocol";
 *
 * const query = new RepositoryQuery("github.com", "octocat/hello-world");
 * ```
 */
export declare class RepositoryQuery {
  /**
   * The host the repository is on, such as `github.com` or `dev.azure.com`.
   */
  public readonly host: string;

  /**
   * The repository's path on the host, such as `octocat/hello-world` or `fabrikam/web/_git/site`.
   */
  public readonly path: string;

  /**
   * Makes a query from its parts.
   *
   * @param host The host, which isn't blank.
   * @param path The repository's path: names of letters, digits, `.`, `_`, `-` and percent escapes such as `%20` but not of `/` or `\` joined by `/`, none of them `.` or `..`, `%2e` counting as a dot.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `path`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.path`.
   * @example
   * ```ts
   * import { RepositoryQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site");
   * ```
   */
  public constructor(host: string, path: string, reader?: JsonReader);

  /**
   * Reads a query from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The query.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { RepositoryQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = RepositoryQuery.fromJson({ host: "github.com", path: "octocat/hello-world" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): RepositoryQuery;

  /**
   * Writes the query as JSON: `host` and `path`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { RepositoryQuery } from "@noldova/git.hosting.protocol";
   *
   * console.log(new RepositoryQuery("github.com", "octocat/hello-world").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * An open pull request as a row of the repository's list: its reference, title and page, whether it is a draft, how many reviewers approve it,
 * and how many of its checks passed, failed or still run.
 *
 * @example
 * ```ts
 * import type { HostPullRequestRow } from "@noldova/git.hosting.protocol";
 *
 * const describe = (row: HostPullRequestRow): string => `#${row.reference.number} ${row.title}: ${row.status}`;
 * ```
 */
export declare class HostPullRequestRow {
  /**
   * The pull request's reference on its host.
   */
  public readonly reference: HostReference;

  /**
   * The pull request's title.
   */
  public readonly title: string;

  /**
   * The pull request's page, an https address.
   */
  public readonly url: string;

  /**
   * Whether the pull request is a draft.
   */
  public readonly isDraft: boolean;

  /**
   * How many reviewers approve it as their latest review or vote.
   */
  public readonly approvals: number;

  /**
   * How many of its checks, builds and blocking policies passed.
   */
  public readonly passed: number;

  /**
   * How many of them failed or were rejected.
   */
  public readonly failing: number;

  /**
   * How many of them run or wait.
   */
  public readonly pending: number;

  /**
   * The branch it merges from, without `refs/heads/`, such as `feature/sign-in`.
   */
  public readonly headBranch: string;

  /**
   * The branch it merges into, without `refs/heads/`, such as `main`, or `null` when the host didn't say.
   */
  public readonly baseBranch: string | null;

  /**
   * Makes a row from its parts.
   *
   * @param reference The pull request's reference.
   * @param title The title, which isn't blank.
   * @param url The page, an https address with no user name or password.
   * @param isDraft Whether it is a draft.
   * @param approvals The approvals, zero or more.
   * @param passed The checks that passed, zero or more.
   * @param failing The checks that failed, zero or more.
   * @param pending The checks that run or wait, zero or more.
   * @param headBranch The branch it merges from, without `refs/heads/`, which isn't blank.
   * @param baseBranch The branch it merges into, without `refs/heads/`, which isn't blank; `null`, the default, when the host didn't say.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `failing`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.rows.0.failing`.
   * @example
   * ```ts
   * import { HostPullRequestRow, HostReference } from "@noldova/git.hosting.protocol";
   *
   * const row = new HostPullRequestRow(new HostReference("git-github", "octocat", "hello-world", 214), "Add the sign-in page",
   *   "https://github.com/octocat/hello-world/pull/214", false, 2, 3, 0, 0, "feature/sign-in");
   * ```
   */
  public constructor(reference: HostReference, title: string, url: string, isDraft: boolean, approvals: number, passed: number, failing: number,
    pending: number, headBranch: string, baseBranch?: string | null, reader?: JsonReader);

  /**
   * The worst of its checks: `Failed` when any failed, else `Pending` when any runs or waits, else `Succeeded` when any passed, else `None`.
   */
  public get status(): PullRequestStatus;

  /**
   * Makes a row from a pull request's parts and its checks: a passed check counts as passed, a failed one as failing, a queued or running one as
   * pending, and a neutral one not at all, so every host counts alike.
   *
   * @param reference The pull request's reference.
   * @param title The title, which isn't blank.
   * @param url The page, an https address with no user name or password.
   * @param isDraft Whether it is a draft.
   * @param approvals The approvals, zero or more.
   * @param checks Its checks, builds and blocking policies as checks.
   * @param headBranch The branch it merges from, without `refs/heads/`, which isn't blank.
   * @param baseBranch The branch it merges into, without `refs/heads/`, which isn't blank; `null`, the default, when the host didn't say.
   * @returns The row.
   * @throws {HostingArgumentException} When a part is out of its range, naming the field as the parameter.
   * @example
   * ```ts
   * import { type HostCheck, HostPullRequestRow, HostReference } from "@noldova/git.hosting.protocol";
   *
   * const rowOf = (checks: readonly HostCheck[]): HostPullRequestRow => HostPullRequestRow.of(new HostReference("git-github", "octocat",
   *   "hello-world", 214), "Add the sign-in page", "https://github.com/octocat/hello-world/pull/214", false, 0, checks, "feature/sign-in");
   * ```
   */
  public static of(reference: HostReference, title: string, url: string, isDraft: boolean, approvals: number,
    checks: readonly HostCheck[], headBranch: string, baseBranch?: string | null): HostPullRequestRow;

  /**
   * Reads a row from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The row.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestRow } from "@noldova/git.hosting.protocol";
   *
   * const row = HostPullRequestRow.fromJson({ reference: { host: "git-github", owner: "octocat", repository: "hello-world", number: 214 },
   *   title: "Add the sign-in page", url: "https://github.com/octocat/hello-world/pull/214", isDraft: false, approvals: 2, passed: 3, failing: 0,
   *   pending: 0, headBranch: "feature/sign-in", baseBranch: "main" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestRow;

  /**
   * Writes the row as JSON: `reference`, `title`, `url`, `isDraft`, `approvals`, `passed`, `failing`, `pending`, `headBranch` and `baseBranch`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostPullRequestRow } from "@noldova/git.hosting.protocol";
   *
   * const send = (row: HostPullRequestRow): string => JSON.stringify(row.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A repository's open pull requests, at most 20 with the most recently updated first, whether it has more, and whether the host was signed in to
 * read them.
 *
 * @example
 * ```ts
 * import type { HostPullRequestList } from "@noldova/git.hosting.protocol";
 *
 * const countOf = (list: HostPullRequestList): string => `${list.rows.length}${list.hasMore ? "+" : ""}`;
 * ```
 */
export declare class HostPullRequestList {
  /**
   * The most rows a list holds: 20.
   */
  public static readonly maximumRows: number;

  /**
   * The open pull requests, the most recently updated first; none while signed out.
   */
  public readonly rows: readonly HostPullRequestRow[];

  /**
   * Whether the repository has more open pull requests than the 20 rows.
   */
  public readonly hasMore: boolean;

  /**
   * Whether the host was signed in to read them.
   */
  public readonly isSignedIn: boolean;

  /**
   * Makes a list from its parts.
   *
   * @param rows The rows, at most 20, and none while signed out.
   * @param hasMore Whether there are more, only with 20 rows.
   * @param isSignedIn Whether the host was signed in; true by default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `hasMore`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.hasMore`.
   * @example
   * ```ts
   * import { HostPullRequestList } from "@noldova/git.hosting.protocol";
   *
   * const empty = new HostPullRequestList([], false);
   * ```
   */
  public constructor(rows: readonly HostPullRequestRow[], hasMore: boolean, isSignedIn?: boolean, reader?: JsonReader);

  /**
   * The list a host answers while signed out: no rows, and not signed in.
   *
   * @returns The list.
   * @example
   * ```ts
   * import { HostPullRequestList } from "@noldova/git.hosting.protocol";
   *
   * const answer = HostPullRequestList.signedOut().toJson();
   * ```
   */
  public static signedOut(): HostPullRequestList;

  /**
   * Reads a list from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The list.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestList } from "@noldova/git.hosting.protocol";
   *
   * const list = HostPullRequestList.fromJson({ rows: [], hasMore: false, isSignedIn: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestList;

  /**
   * Writes the list as JSON: `rows`, `hasMore` and `isSignedIn`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostPullRequestList } from "@noldova/git.hosting.protocol";
   *
   * console.log(HostPullRequestList.signedOut().toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * An open pull request's reference, title, page and branches, without its approvals or checks: what a host reads in one list request to find
 * stacks, where one pull request's base is another's head.
 *
 * @example
 * ```ts
 * import type { HostPullRequestHead } from "@noldova/git.hosting.protocol";
 *
 * const isOn = (head: HostPullRequestHead, under: HostPullRequestHead): boolean => head.baseBranch === under.headBranch;
 * ```
 */
export declare class HostPullRequestHead {
  /**
   * The pull request's reference.
   */
  public readonly reference: HostReference;

  /**
   * Its title.
   */
  public readonly title: string;

  /**
   * Its page on the host, an https address.
   */
  public readonly url: string;

  /**
   * The branch it merges from, without refs/heads/, such as "feature/sign-in".
   */
  public readonly headBranch: string;

  /**
   * The branch it merges into, without refs/heads/, such as "main", or null when the host didn't say.
   */
  public readonly baseBranch: string | null;

  /**
   * Makes a head from its parts.
   *
   * @param reference The pull request's reference.
   * @param title Its title, not blank.
   * @param url Its page, an https address with no user name or password.
   * @param headBranch The branch it merges from, not blank.
   * @param baseBranch The branch it merges into, not blank, or null when the host didn't say.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `headBranch`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.headBranch`.
   * @example
   * ```ts
   * import { HostPullRequestHead, HostReference } from "@noldova/git.hosting.protocol";
   *
   * const head = new HostPullRequestHead(new HostReference("git-azure-devops", "fabrikam", "site", 214), "Add the sign-in page",
   *   "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/214", "feature/sign-in", "main");
   * ```
   */
  public constructor(reference: HostReference, title: string, url: string, headBranch: string, baseBranch: string | null, reader?: JsonReader);

  /**
   * Reads a head from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The head.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestHead } from "@noldova/git.hosting.protocol";
   *
   * const head = HostPullRequestHead.fromJson({ reference: { host: "git-azure-devops", owner: "fabrikam", repository: "site", number: 214 },
   *   title: "Add the sign-in page", url: "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/214", headBranch: "feature/sign-in", baseBranch: "main" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestHead;

  /**
   * Writes the head as JSON: `reference`, `title`, `url`, `headBranch` and `baseBranch`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostPullRequestHead } from "@noldova/git.hosting.protocol";
   *
   * const send = (head: HostPullRequestHead): string => JSON.stringify(head.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A repository's open pull requests' heads, at most 100 with the newest first, whether it has more, and whether the host was signed in to read
 * them: the list stacks are found in, longer than `HostPullRequestList` since it reads nothing for each pull request.
 *
 * @example
 * ```ts
 * import type { HostPullRequestHeads } from "@noldova/git.hosting.protocol";
 *
 * const countOf = (heads: HostPullRequestHeads): string => `${heads.rows.length}${heads.hasMore ? "+" : ""}`;
 * ```
 */
export declare class HostPullRequestHeads {
  /**
   * The most rows a list of heads holds: 100.
   */
  public static readonly maximumRows: number;

  /**
   * The open pull requests' heads, the newest first; none while signed out.
   */
  public readonly rows: readonly HostPullRequestHead[];

  /**
   * Whether the repository has more open pull requests than the 100 rows.
   */
  public readonly hasMore: boolean;

  /**
   * Whether the host was signed in to read them.
   */
  public readonly isSignedIn: boolean;

  /**
   * Makes a list of heads from its parts.
   *
   * @param rows The rows, at most 100, and none while signed out.
   * @param hasMore Whether there are more, only with 100 rows.
   * @param isSignedIn Whether the host was signed in; true by default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `hasMore`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.hasMore`.
   * @example
   * ```ts
   * import { HostPullRequestHeads } from "@noldova/git.hosting.protocol";
   *
   * const empty = new HostPullRequestHeads([], false);
   * ```
   */
  public constructor(rows: readonly HostPullRequestHead[], hasMore: boolean, isSignedIn?: boolean, reader?: JsonReader);

  /**
   * The list a host answers while signed out: no rows, and not signed in.
   *
   * @returns The list.
   * @example
   * ```ts
   * import { HostPullRequestHeads } from "@noldova/git.hosting.protocol";
   *
   * const answer = HostPullRequestHeads.signedOut().toJson();
   * ```
   */
  public static signedOut(): HostPullRequestHeads;

  /**
   * Reads a list of heads from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The list.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestHeads } from "@noldova/git.hosting.protocol";
   *
   * const heads = HostPullRequestHeads.fromJson({ rows: [], hasMore: false, isSignedIn: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestHeads;

  /**
   * Writes the list as JSON: `rows`, `hasMore` and `isSignedIn`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostPullRequestHeads } from "@noldova/git.hosting.protocol";
   *
   * console.log(HostPullRequestHeads.signedOut().toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A commit a pull request brings: its id, its message's first line, its author's name and when they wrote it.
 *
 * @example
 * ```ts
 * import type { HostPullRequestCommit } from "@noldova/git.hosting.protocol";
 *
 * const shortOf = (commit: HostPullRequestCommit): string => commit.id.slice(0, 7);
 * ```
 */
export declare class HostPullRequestCommit {
  /**
   * The commit's full 40-character id.
   */
  public readonly id: string;

  /**
   * Its message's first line; empty for an empty message.
   */
  public readonly subject: string;

  /**
   * Its author's name as the commit holds it.
   */
  public readonly author: string;

  /**
   * When the author wrote it, in milliseconds since the epoch.
   */
  public readonly authoredAt: number;

  /**
   * Makes a commit from its parts.
   *
   * @param id The full 40-character id.
   * @param subject The message's first line.
   * @param author The author's name, not blank.
   * @param authoredAt When it was written, in milliseconds since the epoch, above zero.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path.
   * @example
   * ```ts
   * import { HostPullRequestCommit } from "@noldova/git.hosting.protocol";
   *
   * const commit = new HostPullRequestCommit("9fceb02d0ae598e95dc970b74767f19372d61af8", "Fix the build", "Mona Lisa", Date.UTC(2026, 10, 23));
   * ```
   */
  public constructor(id: string, subject: string, author: string, authoredAt: number, reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The value.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestCommit } from "@noldova/git.hosting.protocol";
   *
   * const commit = HostPullRequestCommit.fromJson({ id: "9fceb02d0ae598e95dc970b74767f19372d61af8", subject: "Fix the build", author: "Mona Lisa", authoredAt: 1795000000000 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestCommit;

  /**
   * Writes it as JSON: `id`, `subject`, `author` and `authoredAt`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostPullRequestCommit } from "@noldova/git.hosting.protocol";
   *
   * const jsonOf = (commit: HostPullRequestCommit): string => JSON.stringify(commit.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The commits a pull request brings, the newest first, at most 250, and whether the host has more.
 *
 * @example
 * ```ts
 * import type { HostPullRequestCommits } from "@noldova/git.hosting.protocol";
 *
 * const countOf = (list: HostPullRequestCommits): string => `${list.commits.length}${list.hasMore ? "+" : ""}`;
 * ```
 */
export declare class HostPullRequestCommits {
  /**
   * The most commits a list holds: 250.
   */
  public static readonly maximumCount: number;

  /**
   * The commits, the newest first.
   */
  public readonly commits: readonly HostPullRequestCommit[];

  /**
   * Whether the pull request brings more than the 250 commits.
   */
  public readonly hasMore: boolean;

  /**
   * Makes a list of commits from its parts.
   *
   * @param commits The commits, at most 250.
   * @param hasMore Whether there are more, only with 250 commits.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path.
   * @example
   * ```ts
   * import { HostPullRequestCommits } from "@noldova/git.hosting.protocol";
   *
   * const none = new HostPullRequestCommits([], false);
   * ```
   */
  public constructor(commits: readonly HostPullRequestCommit[], hasMore: boolean, reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The value.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestCommits } from "@noldova/git.hosting.protocol";
   *
   * const none = HostPullRequestCommits.fromJson({ commits: [], hasMore: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestCommits;

  /**
   * Writes it as JSON: `commits` and `hasMore`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostPullRequestCommits } from "@noldova/git.hosting.protocol";
   *
   * const jsonOf = (list: HostPullRequestCommits): string => JSON.stringify(list.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A pull request's comment threads and whether the host has older comments than they hold, such as GitHub's answer, which keeps the newest 100 of each
 * kind of comment.
 *
 * @example
 * ```ts
 * import type { HostPullRequestThreads } from "@noldova/git.hosting.protocol";
 *
 * const countOf = (list: HostPullRequestThreads): string => `${list.threads.length}${list.hasMore ? "+" : ""}`;
 * ```
 */
export declare class HostPullRequestThreads {
  /**
   * The threads, oldest first by their first comment.
   */
  public readonly threads: readonly HostThread[];

  /**
   * Whether the host has older comments than the threads hold.
   */
  public readonly hasMore: boolean;

  /**
   * Makes a pull request's threads from its parts, copying the list.
   *
   * @param threads The threads.
   * @param hasMore Whether the host has older comments than they hold.
   * @example
   * ```ts
   * import { HostPullRequestThreads } from "@noldova/git.hosting.protocol";
   *
   * const none = new HostPullRequestThreads([], false);
   * ```
   */
  public constructor(threads: readonly HostThread[], hasMore: boolean);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The value.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a thread is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestThreads } from "@noldova/git.hosting.protocol";
   *
   * const none = HostPullRequestThreads.fromJson({ threads: [], hasMore: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestThreads;

  /**
   * Writes it as JSON: `threads` and `hasMore`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostPullRequestThreads } from "@noldova/git.hosting.protocol";
   *
   * const jsonOf = (list: HostPullRequestThreads): string => JSON.stringify(list.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The paths of the files that keep a pull request from merging, at most 100, and whether the host has more.
 *
 * @example
 * ```ts
 * import type { HostPullRequestConflicts } from "@noldova/git.hosting.protocol";
 *
 * const countOf = (list: HostPullRequestConflicts): string => `${list.paths.length}${list.hasMore ? "+" : ""}`;
 * ```
 */
export declare class HostPullRequestConflicts {
  /**
   * The most paths a list holds: 100.
   */
  public static readonly maximumCount: number;

  /**
   * The conflicting files' paths in the repository, such as `src/app.ts`.
   */
  public readonly paths: readonly string[];

  /**
   * Whether the pull request has more than the 100 conflicts.
   */
  public readonly hasMore: boolean;

  /**
   * Makes a list of conflicts from its parts.
   *
   * @param paths The paths, none blank, at most 100.
   * @param hasMore Whether there are more, only with 100 paths.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path.
   * @example
   * ```ts
   * import { HostPullRequestConflicts } from "@noldova/git.hosting.protocol";
   *
   * const none = new HostPullRequestConflicts([], false);
   * ```
   */
  public constructor(paths: readonly string[], hasMore: boolean, reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The value.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestConflicts } from "@noldova/git.hosting.protocol";
   *
   * const none = HostPullRequestConflicts.fromJson({ paths: [], hasMore: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestConflicts;

  /**
   * Writes it as JSON: `paths` and `hasMore`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostPullRequestConflicts } from "@noldova/git.hosting.protocol";
   *
   * const jsonOf = (value: HostPullRequestConflicts): string => JSON.stringify(value.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A file a pull request changes: its path, what the pull request did to it, and for a moved file the path it had.
 *
 * @example
 * ```ts
 * import type { HostPullRequestFile } from "@noldova/git.hosting.protocol";
 *
 * const labelOf = (file: HostPullRequestFile): string => file.previousPath === null ? file.path : `${file.previousPath} → ${file.path}`;
 * ```
 */
export declare class HostPullRequestFile {
  /**
   * The file's path in the repository, such as `src/app.ts`.
   */
  public readonly path: string;

  /**
   * What the pull request did to the file.
   */
  public readonly kind: FileChangeKind;

  /**
   * The path a moved file had; `null` for any other change.
   */
  public readonly previousPath: string | null;

  /**
   * Makes a changed file from its parts.
   *
   * @param path The file's path, not blank.
   * @param kind What the pull request did to it.
   * @param previousPath The path it had, not blank, for a moved file only; `null` otherwise.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path.
   * @example
   * ```ts
   * import { HostPullRequestFile } from "@noldova/git.hosting.protocol";
   *
   * const added = new HostPullRequestFile("src/app.ts", "Added", null);
   * ```
   */
  public constructor(path: string, kind: FileChangeKind, previousPath: string | null, reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The value.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestFile } from "@noldova/git.hosting.protocol";
   *
   * const added = HostPullRequestFile.fromJson({ path: "src/app.ts", kind: "Added", previousPath: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestFile;

  /**
   * Writes it as JSON: `path`, `kind` and `previousPath`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostPullRequestFile } from "@noldova/git.hosting.protocol";
   *
   * const jsonOf = (value: HostPullRequestFile): string => JSON.stringify(value.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The files a pull request changes at its latest push, at most 5000, and whether the host has more, with that push's head commit and the commit its changes count from.
 *
 * @example
 * ```ts
 * import type { HostPullRequestFiles } from "@noldova/git.hosting.protocol";
 *
 * const countOf = (list: HostPullRequestFiles): string => `${list.files.length}${list.hasMore ? "+" : ""}`;
 * ```
 */
export declare class HostPullRequestFiles {
  /**
   * The most files a list holds: 5000.
   */
  public static readonly maximumCount: number;

  /**
   * The latest push's head commit; `null` when the host doesn't show the pull request.
   */
  public readonly sourceCommit: string | null;

  /**
   * The commit the changes count from, where the target branch and the pull request's branch meet; `null` when the host doesn't say.
   */
  public readonly commonCommit: string | null;

  /**
   * The changed files, in the host's order.
   */
  public readonly files: readonly HostPullRequestFile[];

  /**
   * Whether the host lists more files than the list holds.
   */
  public readonly hasMore: boolean;

  /**
   * Makes a list of changed files from its parts.
   *
   * @param sourceCommit The head commit, 40 hexadecimal digits, or `null` with no common commit and no files.
   * @param commonCommit The commit the changes count from, 40 hexadecimal digits, or `null`.
   * @param files The files, at most 5000.
   * @param hasMore Whether there are more, only with a head commit.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path.
   * @example
   * ```ts
   * import { HostPullRequestFiles } from "@noldova/git.hosting.protocol";
   *
   * const none = new HostPullRequestFiles(null, null, [], false);
   * ```
   */
  public constructor(sourceCommit: string | null, commonCommit: string | null, files: readonly HostPullRequestFile[], hasMore: boolean, reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The value.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestFiles } from "@noldova/git.hosting.protocol";
   *
   * const none = HostPullRequestFiles.fromJson({ sourceCommit: null, commonCommit: null, files: [], hasMore: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestFiles;

  /**
   * Writes it as JSON: `sourceCommit`, `commonCommit`, `files` and `hasMore`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostPullRequestFiles } from "@noldova/git.hosting.protocol";
   *
   * const jsonOf = (value: HostPullRequestFiles): string => JSON.stringify(value.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One push to a pull request: its number, who pushed it and when, the commit it brought the pull request to and the commit its changes count from.
 *
 * @example
 * ```ts
 * import type { HostPullRequestUpdate } from "@noldova/git.hosting.protocol";
 *
 * const titleOf = (update: HostPullRequestUpdate): string => `Update ${update.number}`;
 * ```
 */
export declare class HostPullRequestUpdate {
  /**
   * The update's number, from 1 for the pull request's first push.
   */
  public readonly number: number;

  /**
   * Who pushed it; null when the host doesn't say.
   */
  public readonly author: HostPerson | null;

  /**
   * When it was pushed, in milliseconds since the epoch.
   */
  public readonly createdAt: number;

  /**
   * The pull request's head commit after this update.
   */
  public readonly sourceCommit: string;

  /**
   * The commit the changes count from, the last one the head shares with the target branch; null when the host names none.
   */
  public readonly commonCommit: string | null;

  /**
   * Makes an update from its parts.
   *
   * @param number The update's number, above zero.
   * @param author Who pushed it, or null.
   * @param createdAt When it was pushed, in milliseconds since the epoch, above zero.
   * @param sourceCommit The head commit's full id.
   * @param commonCommit The common commit's full id, or null.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path.
   * @example
   * ```ts
   * import { HostPullRequestUpdate } from "@noldova/git.hosting.protocol";
   *
   * const update = new HostPullRequestUpdate(1, null, Date.UTC(2026, 10, 23), "9fceb02d0ae598e95dc970b74767f19372d61af8", null);
   * ```
   */
  public constructor(number: number, author: HostPerson | null, createdAt: number, sourceCommit: string, commonCommit: string | null, reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The value.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestUpdate } from "@noldova/git.hosting.protocol";
   *
   * const update = HostPullRequestUpdate.fromJson({ number: 1, author: null, createdAt: 1795000000000, sourceCommit: "9fceb02d0ae598e95dc970b74767f19372d61af8", commonCommit: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestUpdate;

  /**
   * Writes it as JSON: `number`, `author`, `createdAt`, `sourceCommit` and `commonCommit`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostPullRequestUpdate } from "@noldova/git.hosting.protocol";
   *
   * const jsonOf = (update: HostPullRequestUpdate): string => JSON.stringify(update.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The pushes to a pull request, the newest first, at most 100, and whether the host has more.
 *
 * @example
 * ```ts
 * import type { HostPullRequestUpdates } from "@noldova/git.hosting.protocol";
 *
 * const latestOf = (list: HostPullRequestUpdates): number | null => list.updates[0]?.number ?? null;
 * ```
 */
export declare class HostPullRequestUpdates {
  /**
   * The most updates a list holds: 100.
   */
  public static readonly maximumCount: number;

  /**
   * The updates, the newest first.
   */
  public readonly updates: readonly HostPullRequestUpdate[];

  /**
   * Whether the pull request has more than the 100 updates.
   */
  public readonly hasMore: boolean;

  /**
   * Makes a list of updates from its parts.
   *
   * @param updates The updates, at most 100.
   * @param hasMore Whether there are more, only with 100 updates.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path.
   * @example
   * ```ts
   * import { HostPullRequestUpdates } from "@noldova/git.hosting.protocol";
   *
   * const none = new HostPullRequestUpdates([], false);
   * ```
   */
  public constructor(updates: readonly HostPullRequestUpdate[], hasMore: boolean, reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The value.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostPullRequestUpdates } from "@noldova/git.hosting.protocol";
   *
   * const none = HostPullRequestUpdates.fromJson({ updates: [], hasMore: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostPullRequestUpdates;

  /**
   * Writes it as JSON: `updates` and `hasMore`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostPullRequestUpdates } from "@noldova/git.hosting.protocol";
   *
   * const jsonOf = (list: HostPullRequestUpdates): string => JSON.stringify(list.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * An open pull request that asks the signed-in person for a review: its reference, title, page, whether it is a draft, and when it was opened.
 *
 * @example
 * ```ts
 * import type { HostReviewRequest } from "@noldova/git.hosting.protocol";
 *
 * const describe = (request: HostReviewRequest): string => `Review #${request.reference.number} ${request.title}`;
 * ```
 */
export declare class HostReviewRequest {
  /**
   * The pull request's reference on its host.
   */
  public readonly reference: HostReference;

  /**
   * Its title, never blank.
   */
  public readonly title: string;

  /**
   * Its page on the host, an https address.
   */
  public readonly url: string;

  /**
   * Whether it is a draft.
   */
  public readonly isDraft: boolean;

  /**
   * When it was opened, in milliseconds since the Unix epoch.
   */
  public readonly createdAt: number;

  /**
   * The login of the account the request is for, when the module keeps several accounts and more than one is signed in; null otherwise.
   */
  public readonly account: string | null;

  /**
   * Makes a review request from its parts.
   *
   * @param reference The pull request's reference.
   * @param title Its title, not blank.
   * @param url Its page, an https address.
   * @param isDraft Whether it is a draft.
   * @param createdAt When it was opened, a positive whole number of milliseconds since the Unix epoch.
   * @param account The login of the account the request is for, not blank, or null, the default, when only one account is signed in.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `title`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.title`.
   * @example
   * ```ts
   * import { HostReference, HostReviewRequest } from "@noldova/git.hosting.protocol";
   *
   * const request = new HostReviewRequest(new HostReference("git-github", "octocat", "hello-world", 533), "Sign in with a passkey",
   *   "https://github.com/octocat/hello-world/pull/533", false, Date.parse("2026-11-20T09:00:00Z"));
   * ```
   */
  public constructor(reference: HostReference, title: string, url: string, isDraft: boolean, createdAt: number, account?: string | null, reader?: JsonReader);

  /**
   * Reads a review request from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The review request.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostReviewRequest } from "@noldova/git.hosting.protocol";
   *
   * const read = (json: unknown): HostReviewRequest => HostReviewRequest.fromJson(json, "$.request");
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostReviewRequest;

  /**
   * Writes the review request as JSON: `reference`, `title`, `url`, `isDraft` and `createdAt`, and `account` when it isn't null.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostReviewRequest } from "@noldova/git.hosting.protocol";
   *
   * const send = (request: HostReviewRequest): string => JSON.stringify(request.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The open pull requests on a repository that ask the signed-in person for a review, the newest first, whether the host's answer was cut, and
 * whether the host was signed in to read them.
 *
 * @example
 * ```ts
 * import type { HostReviewRequestList } from "@noldova/git.hosting.protocol";
 *
 * const countOf = (list: HostReviewRequestList): string => `${list.rows.length}${list.hasMore ? "+" : ""}`;
 * ```
 */
export declare class HostCommitComments {
  /**
   * The most comments a count holds: 100, one page of the host's answer.
   */
  public static readonly maximumCount: number;

  /**
   * The review comments on the commit, from 0 to 100.
   */
  public readonly count: number;

  /**
   * Whether a page of the host's answer was full, so there may be more than the count; only with comments.
   */
  public readonly isCapped: boolean;

  /**
   * The https page on the host that shows the comments; null exactly when there are none.
   */
  public readonly url: string | null;

  /**
   * Makes a count from its parts.
   *
   * @param count The comments, from 0 to 100.
   * @param isCapped Whether a page of the host's answer was full, only with comments.
   * @param url The https page that shows them, null exactly when the count is 0.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `count`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.count`.
   * @example
   * ```ts
   * import { HostCommitComments } from "@noldova/git.hosting.protocol";
   *
   * const three = new HostCommitComments(3, false, "https://github.com/octocat/hello-world/commit/9fceb02d0ae598e95dc970b74767f19372d61af8");
   * ```
   */
  public constructor(count: number, isCapped: boolean, url: string | null, reader?: JsonReader);

  /**
   * The count a host answers when it has no comments to count: none, not capped, and no page.
   *
   * @returns The count.
   * @example
   * ```ts
   * import { HostCommitComments } from "@noldova/git.hosting.protocol";
   *
   * const answer = HostCommitComments.none().toJson();
   * ```
   */
  public static none(): HostCommitComments;

  /**
   * Reads a count from JSON, refusing a field it doesn't define.
   *
   * @param value The JSON.
   * @param path The JSON's path, `$` by default.
   * @returns The count.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When a field is unknown or out of its range.
   * @example
   * ```ts
   * import { HostCommitComments } from "@noldova/git.hosting.protocol";
   *
   * const comments = HostCommitComments.fromJson({ count: 0, isCapped: false, url: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostCommitComments;

  /**
   * Writes the count as JSON: `count`, `isCapped` and `url`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import type { HostCommitComments } from "@noldova/git.hosting.protocol";
   *
   * const send = (comments: HostCommitComments): string => JSON.stringify(comments.toJson());
   * ```
   */
  public toJson(): JsonObject;
}

export declare class HostReviewRequestList {
  /**
   * The most rows a list holds: 100.
   */
  public static readonly maximumRows: number;

  /**
   * The review requests, the newest first; none while signed out.
   */
  public readonly rows: readonly HostReviewRequest[];

  /**
   * Whether the host's answer was cut, so the repository may have review requests past these rows. A host that reads every repository of the
   * account in one answer sets it on each repository's list when that answer was cut.
   */
  public readonly hasMore: boolean;

  /**
   * Whether the host was signed in to read them.
   */
  public readonly isSignedIn: boolean;

  /**
   * Makes a list from its parts.
   *
   * @param rows The rows, at most 100, and none while signed out.
   * @param hasMore Whether the host's answer was cut, only while signed in.
   * @param isSignedIn Whether the host was signed in; true by default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `rows`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.rows`.
   * @example
   * ```ts
   * import { HostReviewRequestList } from "@noldova/git.hosting.protocol";
   *
   * const empty = new HostReviewRequestList([], false);
   * ```
   */
  public constructor(rows: readonly HostReviewRequest[], hasMore: boolean, isSignedIn?: boolean, reader?: JsonReader);

  /**
   * The list a host answers while signed out: no rows, and not signed in.
   *
   * @returns The list.
   * @example
   * ```ts
   * import { HostReviewRequestList } from "@noldova/git.hosting.protocol";
   *
   * const answer = HostReviewRequestList.signedOut().toJson();
   * ```
   */
  public static signedOut(): HostReviewRequestList;

  /**
   * Reads a list from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The list.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostReviewRequestList } from "@noldova/git.hosting.protocol";
   *
   * const list = HostReviewRequestList.fromJson({ rows: [], hasMore: false, isSignedIn: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostReviewRequestList;

  /**
   * Writes the list as JSON: `rows`, `hasMore` and `isSignedIn`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostReviewRequestList } from "@noldova/git.hosting.protocol";
   *
   * console.log(HostReviewRequestList.signedOut().toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One of the accounts a module keeps, by its id, for a sign-in method that acts on one account.
 *
 * @example
 * ```ts
 * import { AccountQuery } from "@noldova/git.hosting.protocol";
 *
 * const query = new AccountQuery(2);
 * ```
 */
export declare class AccountQuery {
  /**
   * The account's id, which the module gave it when it was added; the first account is 1.
   */
  public readonly account: number;

  /**
   * Makes the query from its parts.
   *
   * @param account The account's id, a positive whole number.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `account`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.account`.
   * @example
   * ```ts
   * import { AccountQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = new AccountQuery(1);
   * ```
   */
  public constructor(account: number, reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The query.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { AccountQuery } from "@noldova/git.hosting.protocol";
   *
   * const query = AccountQuery.fromJson({ account: 2 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): AccountQuery;

  /**
   * Writes it as JSON: `account`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { AccountQuery } from "@noldova/git.hosting.protocol";
   *
   * console.log(AccountQuery.fromJson({ account: 2 }).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One account a module keeps: its id and its sign-in.
 *
 * @example
 * ```ts
 * import { HostAccountEntry, HostSignIn } from "@noldova/git.hosting.protocol";
 *
 * const entry = new HostAccountEntry(2, HostSignIn.signedOut());
 * ```
 */
export declare class HostAccountEntry {
  /**
   * The account's id, which the module gave it when it was added; the first account is 1.
   */
  public readonly id: number;

  /**
   * The account's sign-in: waiting with its device code, signed in with its login, or signed out.
   */
  public readonly signIn: HostSignIn;

  /**
   * Makes the entry from its parts.
   *
   * @param id The account's id, a positive whole number.
   * @param signIn The account's sign-in.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `account`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.account`.
   * @example
   * ```ts
   * import { HostAccount, HostAccountEntry, HostSignIn } from "@noldova/git.hosting.protocol";
   *
   * const entry = new HostAccountEntry(1, HostSignIn.signedIn(new HostAccount("octocat", null, null, ["repo"])));
   * ```
   */
  public constructor(id: number, signIn: HostSignIn, reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The entry.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostAccountEntry } from "@noldova/git.hosting.protocol";
   *
   * const entry = HostAccountEntry.fromJson({ id: 2, signIn: { state: "SignedOut", deviceCode: null, account: null, failure: null } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostAccountEntry;

  /**
   * Writes it as JSON: `id` and `signIn`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostAccountEntry } from "@noldova/git.hosting.protocol";
   *
   * console.log(HostAccountEntry.fromJson({ id: 2, signIn: { state: "SignedOut", deviceCode: null, account: null, failure: null } }).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Every account a module keeps on this computer, the first account first.
 *
 * @example
 * ```ts
 * import { HostAccountList } from "@noldova/git.hosting.protocol";
 *
 * const list = new HostAccountList([]);
 * ```
 */
export declare class HostAccountList {
  /**
   * The accounts, each id once, the first account first and the others in the order they were added.
   */
  public readonly accounts: readonly HostAccountEntry[];

  /**
   * Makes the list from its parts.
   *
   * @param accounts The accounts, each id once.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `account`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.account`.
   * @example
   * ```ts
   * import { HostAccountEntry, HostAccountList, HostSignIn } from "@noldova/git.hosting.protocol";
   *
   * const list = new HostAccountList([new HostAccountEntry(1, HostSignIn.signedOut())]);
   * ```
   */
  public constructor(accounts: readonly HostAccountEntry[], reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The list.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { HostAccountList } from "@noldova/git.hosting.protocol";
   *
   * const list = HostAccountList.fromJson({ accounts: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostAccountList;

  /**
   * Writes it as JSON: `accounts`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { HostAccountList } from "@noldova/git.hosting.protocol";
   *
   * console.log(HostAccountList.fromJson({ accounts: [] }).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The account a person chose for a repository, which the module remembers on this computer.
 *
 * @example
 * ```ts
 * import { AccountPick } from "@noldova/git.hosting.protocol";
 *
 * const pick = new AccountPick("github.com", "octocat/hello-world", 2);
 * ```
 */
export declare class AccountPick {
  /**
   * The host the repository is on, such as `github.com`.
   */
  public readonly host: string;

  /**
   * The repository's path on the host, such as `octocat/hello-world`.
   */
  public readonly path: string;

  /**
   * The chosen account's id.
   */
  public readonly account: number;

  /**
   * Makes the pick from its parts.
   *
   * @param host The host, which isn't blank.
   * @param path The repository's path, as `RepositoryQuery` takes it.
   * @param account The account's id, a positive whole number.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `account`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.account`.
   * @example
   * ```ts
   * import { AccountPick } from "@noldova/git.hosting.protocol";
   *
   * const pick = new AccountPick("github.com", "octocat/hello-world", 1);
   * ```
   */
  public constructor(host: string, path: string, account: number, reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The pick.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { AccountPick } from "@noldova/git.hosting.protocol";
   *
   * const pick = AccountPick.fromJson({ host: "github.com", path: "octocat/hello-world", account: 2 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): AccountPick;

  /**
   * Writes it as JSON: `host`, `path` and `account`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { AccountPick } from "@noldova/git.hosting.protocol";
   *
   * console.log(AccountPick.fromJson({ host: "github.com", path: "octocat/hello-world", account: 2 }).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The account a module reads a repository with, or none when no account kept is signed in.
 *
 * @example
 * ```ts
 * import { RepositoryAccount } from "@noldova/git.hosting.protocol";
 *
 * const none = new RepositoryAccount(null);
 * ```
 */
export declare class RepositoryAccount {
  /**
   * The account's id, or null when no account kept is signed in.
   */
  public readonly account: number | null;

  /**
   * Makes the answer from its parts.
   *
   * @param account The account's id, a positive whole number, or null.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `account`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.account`.
   * @example
   * ```ts
   * import { RepositoryAccount } from "@noldova/git.hosting.protocol";
   *
   * const answer = new RepositoryAccount(2);
   * ```
   */
  public constructor(account: number | null, reader?: JsonReader);

  /**
   * Reads it from its JSON.
   *
   * @param value The JSON, with exactly the fields `toJson` writes.
   * @param path The JSON's path, `$` by default.
   * @returns The answer.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { RepositoryAccount } from "@noldova/git.hosting.protocol";
   *
   * const answer = RepositoryAccount.fromJson({ account: 1 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): RepositoryAccount;

  /**
   * Writes it as JSON: `account`.
   *
   * @returns The JSON.
   * @example
   * ```ts
   * import { RepositoryAccount } from "@noldova/git.hosting.protocol";
   *
   * console.log(RepositoryAccount.fromJson({ account: 1 }).toJson());
   * ```
   */
  public toJson(): JsonObject;
}
