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
   * The host showed a code and waits for the person to enter it on the host's page.
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
   * The code, exactly while the sign-in waits.
   */
  public readonly deviceCode: DeviceCode | null;

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
   * @param deviceCode The code, exactly while it waits.
   * @param account The account, exactly while signed in.
   * @param failure The failure, only while signed out.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
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
  public constructor(state: SignInState, deviceCode: DeviceCode | null, account: HostAccount | null, failure: SignInFailure | null, reader?: JsonReader);

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
   * const signIn = HostSignIn.fromJson({ state: "SignedOut", deviceCode: null, account: null, failure: "Expired" });
   * console.log(signIn.state);
   * ```
   */
  public static fromJson(value: unknown, path?: string): HostSignIn;

  /**
   * Writes the sign-in as JSON: `state`, `deviceCode`, `account` and `failure`, each null when it has none.
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
   */
  public static readonly startSignInMethod: string;

  /**
   * The method that stops a sign-in that waits, and answers the sign-in.
   */
  public static readonly cancelSignInMethod: string;

  /**
   * The method that forgets the kept token on this computer, and answers the sign-in.
   */
  public static readonly signOutMethod: string;

  /**
   * The event that carries the sign-in as `HostSignIn` JSON each time it changes.
   */
  public static readonly signInChangedEvent: string;

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
   * The method that takes a `PullRequestDraft` as JSON, opens the pull request on the host and answers it as `HostItem` JSON.
   */
  public static readonly createPullRequestMethod: string;

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
   * @param owner The owner of the repository on the host: names of letters, digits, `.`, `_` and `-` joined by `/` for nested groups, none of them `.` or `..`.
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
 * A person on a host, such as the author of a pull request or an issue: their login and their avatar.
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
   * Makes a person from their parts.
   *
   * @param login The login, which isn't blank.
   * @param avatar The avatar as a base64 data address of a PNG, JPEG, GIF or WebP image of at most 64 KiB, or null.
   * @param url The profile page as an https address, or null.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when a part is out of its range, naming the field as the parameter, such as `login`.
   * @throws {HostingFieldException} With a reader, when a part is out of its range, naming the field by its path, such as `$.login`.
   * @example
   * ```ts
   * import { HostPerson } from "@noldova/git.hosting.protocol";
   *
   * const person = new HostPerson("monalisa", null, null);
   * ```
   */
  public constructor(login: string, avatar: string | null, url: string | null, reader?: JsonReader);

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
   * Writes the person as JSON: `login`, `avatar` and `url`, each of the last two null when there is none.
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
   * The lines the pull request adds.
   */
  public readonly additions: number;

  /**
   * The lines the pull request deletes.
   */
  public readonly deletions: number;

  /**
   * The files the pull request changes.
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
   * Makes changes from their parts.
   *
   * @param additions The lines added, a whole number, zero or more.
   * @param deletions The lines deleted, a whole number, zero or more.
   * @param changedFiles The files changed, a whole number, zero or more.
   * @param headBranch The head branch, which isn't blank.
   * @param baseBranch The base branch, which isn't blank.
   * @param headCommit The head commit, a full hash of 40 or 64 lowercase hexadecimal digits.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
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
    reader?: JsonReader);

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
   * Writes the changes as JSON: `additions`, `deletions`, `changedFiles`, `headBranch`, `baseBranch` and `headCommit`.
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
   * @param path The repository's path: names of letters, digits, `.`, `_` and `-` joined by `/`, none of them `.` or `..`.
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
   * Makes an answer from its parts.
   *
   * @param pullRequest The pull request, an item of the kind `PullRequest`, or null.
   * @param checks The checks, none when the pull request is null.
   * @param reviewDecision Where the review stands, null exactly when the pull request is; `Waiting` for a pull request, and null without one, by default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {HostingArgumentException} Without a reader, when the item isn't a pull request, there are checks with no pull request, or the review
   * decision is null for a pull request or set without one, naming the field as the parameter, `pullRequest`, `checks` or `reviewDecision`.
   * @throws {HostingFieldException} With a reader, when the item isn't a pull request, there are checks with no pull request, or the review
   * decision is null for a pull request or set without one, naming the field by its path, such as `$.checks`.
   * @example
   * ```ts
   * import { BranchPullRequest } from "@noldova/git.hosting.protocol";
   *
   * const none = new BranchPullRequest(null, []);
   * ```
   */
  public constructor(pullRequest: HostItem | null, checks: readonly HostCheck[], reviewDecision?: ReviewDecision | null, reader?: JsonReader);

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
   * `Waiting`.
   * @param path The JSON's path, `$` by default.
   * @returns The answer.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or the review decision isn't one of
   * `ReviewDecision`'s; it comes from `@noldova/context.json`.
   * @throws {HostingFieldException} When the value holds an unknown field, a field is out of its range, the item isn't a pull request,
   * there are checks with no pull request, or the review decision is null for a pull request or set without one.
   * @example
   * ```ts
   * import { BranchPullRequest } from "@noldova/git.hosting.protocol";
   *
   * const none = BranchPullRequest.fromJson({ pullRequest: null, checks: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): BranchPullRequest;

  /**
   * Writes the answer as JSON: `pullRequest`, null when there is none, `checks` and `reviewDecision`, null without a pull request.
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
   * @param path The repository's path: names of letters, digits, `.`, `_` and `-` joined by `/`, none of them `.` or `..`.
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
