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
  private static readonly FIELDS: readonly string[] = [Resources.stateField, Resources.deviceCodeField, Resources.addressField, Resources.accountField,
    Resources.failureField];
  private static readonly STATES: readonly SignInState[] = Object.values(SignInState);
  private static readonly FAILURES: readonly SignInFailure[] = Object.values(SignInFailure);

  public readonly state: SignInState;
  public readonly deviceCode: DeviceCode | null;
  public readonly address: string | null;
  public readonly account: HostAccount | null;
  public readonly failure: SignInFailure | null;

  public constructor(state: SignInState, deviceCode: DeviceCode | null, account: HostAccount | null, failure: SignInFailure | null, reader?: JsonReader,
    address: string | null = null) {
    if ((state === SignInState.Waiting) !== (deviceCode !== null || address !== null))
      FieldCheck.fail(deviceCode === null && address !== null ? Resources.addressField : Resources.deviceCodeField, Resources.deviceCodeExpected, reader);
    if (deviceCode !== null && address !== null)
      FieldCheck.fail(Resources.addressField, Resources.deviceCodeExpected, reader);
    if (address !== null)
      FieldCheck.requireHttps(address, Resources.addressField, reader);
    if ((state === SignInState.SignedIn) !== (account !== null))
      FieldCheck.fail(Resources.accountField, Resources.accountExpected, reader);
    if (state !== SignInState.SignedOut && failure !== null)
      FieldCheck.fail(Resources.failureField, Resources.failureExpected, reader);

    this.state = state;
    this.deviceCode = deviceCode;
    this.address = address;
    this.account = account;
    this.failure = failure;
  }

  public static signedOut(failure?: SignInFailure): HostSignIn {
    return new HostSignIn(SignInState.SignedOut, null, null, failure ?? null);
  }

  public static waiting(deviceCode: DeviceCode): HostSignIn {
    return new HostSignIn(SignInState.Waiting, deviceCode, null, null);
  }

  public static waitingInBrowser(address: string): HostSignIn {
    return new HostSignIn(SignInState.Waiting, null, null, null, undefined, address);
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
      reader,
      reader.hasField(Resources.addressField) ? reader.readNullableString(Resources.addressField) : null);
  }

  /** The JSON, with `address` only while a sign-in waits in the browser, so every other sign-in writes the fields it always has. */
  public toJson(): JsonObject {
    return {
      [Resources.stateField]: this.state,
      [Resources.deviceCodeField]: this.deviceCode?.toJson() ?? null,
      [Resources.accountField]: this.account?.toJson() ?? null,
      [Resources.failureField]: this.failure,
      ...this.address === null ? {} : { [Resources.addressField]: this.address }
    };
  }
}
