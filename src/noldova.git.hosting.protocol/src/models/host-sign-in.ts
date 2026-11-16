/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { SignInFailure } from "../enums/sign-in-failure.ts";
import { SignInState } from "../enums/sign-in-state.ts";
import { Resources } from "../resources.ts";
import { DeviceCode } from "./device-code.ts";
import { FieldCheck } from "./field-check.ts";
import { HostAccount } from "./host-account.ts";

export class HostSignIn {
  private static readonly FIELDS: readonly string[] = [Resources.stateField, Resources.deviceCodeField, Resources.accountField, Resources.failureField];
  private static readonly STATES: readonly SignInState[] = Object.values(SignInState);
  private static readonly FAILURES: readonly SignInFailure[] = Object.values(SignInFailure);

  public readonly state: SignInState;
  public readonly deviceCode: DeviceCode | null;
  public readonly account: HostAccount | null;
  public readonly failure: SignInFailure | null;

  public constructor(state: SignInState, deviceCode: DeviceCode | null, account: HostAccount | null, failure: SignInFailure | null, reader?: JsonReader) {
    if ((state === SignInState.Waiting) !== (deviceCode !== null))
      FieldCheck.fail(Resources.deviceCodeField, Resources.deviceCodeExpected, reader);
    if ((state === SignInState.SignedIn) !== (account !== null))
      FieldCheck.fail(Resources.accountField, Resources.accountExpected, reader);
    if (state !== SignInState.SignedOut && failure !== null)
      FieldCheck.fail(Resources.failureField, Resources.failureExpected, reader);

    this.state = state;
    this.deviceCode = deviceCode;
    this.account = account;
    this.failure = failure;
  }

  public static signedOut(failure?: SignInFailure): HostSignIn {
    return new HostSignIn(SignInState.SignedOut, null, null, failure ?? null);
  }

  public static waiting(deviceCode: DeviceCode): HostSignIn {
    return new HostSignIn(SignInState.Waiting, deviceCode, null, null);
  }

  public static signedIn(account: HostAccount): HostSignIn {
    return new HostSignIn(SignInState.SignedIn, null, account, null);
  }

  public static fromJson(value: unknown, path?: string): HostSignIn {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostSignIn.FIELDS);
    return new HostSignIn(
      reader.readOneOf(Resources.stateField, HostSignIn.STATES),
      FieldCheck.readNullableModel(reader, Resources.deviceCodeField, DeviceCode.fromJson),
      FieldCheck.readNullableModel(reader, Resources.accountField, HostAccount.fromJson),
      FieldCheck.readNullableMember(reader, Resources.failureField, HostSignIn.FAILURES),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.stateField]: this.state,
      [Resources.deviceCodeField]: this.deviceCode?.toJson() ?? null,
      [Resources.accountField]: this.account?.toJson() ?? null,
      [Resources.failureField]: this.failure
    };
  }
}
