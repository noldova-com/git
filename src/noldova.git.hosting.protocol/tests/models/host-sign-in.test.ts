/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { DeviceCode, HostAccount, HostingArgumentException, HostingFieldException, HostSignIn, SignInFailure, SignInState } from "../../src/api/index.ts";

const code: DeviceCode = new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_000_000);
const avatar: string = "data:image/png;base64,iVBORw0KGgo=";
const address: string = "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?client_id=contoso";
const account: HostAccount = new HostAccount("octocat", "The Octocat", avatar, ["repo"]);

function roundTrip(signIn: HostSignIn): HostSignIn {
  return HostSignIn.fromJson(JSON.parse(JSON.stringify(signIn.toJson())));
}

describe("HostSignIn", () => {
  it("keeps each state's parts and returns them as JSON that reads back the same", () => {
    const waiting: HostSignIn = HostSignIn.waiting(code);
    const signedIn: HostSignIn = HostSignIn.signedIn(account);
    const failed: HostSignIn = HostSignIn.signedOut(SignInFailure.Expired);

    assert.deepEqual(waiting.toJson(), {
      state: "Waiting",
      deviceCode: { userCode: "WDJB-MJHT", verificationUri: "https://github.com/login/device", expiresAt: 1_800_000_000_000 },
      account: null,
      failure: null
    });
    assert.deepEqual(signedIn.toJson()["account"], { login: "octocat", name: "The Octocat", avatar, scopes: ["repo"] });
    assert.deepEqual([roundTrip(waiting), roundTrip(signedIn), roundTrip(failed), roundTrip(HostSignIn.signedOut())], [waiting, signedIn, failed, HostSignIn.signedOut()]);
    assert.deepEqual([failed.state, failed.failure, HostSignIn.signedOut().failure], [SignInState.SignedOut, SignInFailure.Expired, null]);
  });

  it("waits in the browser on an https address in place of a code, and reads it back", () => {
    const waiting: HostSignIn = HostSignIn.waitingInBrowser(address);

    assert.deepEqual(waiting.toJson(), { state: "Waiting", deviceCode: null, account: null, failure: null, address });
    assert.deepEqual([roundTrip(waiting), waiting.deviceCode], [waiting, null]);
  });

  it("takes a code or an address exactly while it waits, an account exactly while signed in, and a failure only while signed out", () => {
    assert.throws(() => new HostSignIn(SignInState.Waiting, null, null, null), HostingArgumentException);
    assert.throws(() => new HostSignIn(SignInState.Waiting, null, null, null), { name: "HostingArgumentException", parameterName: "deviceCode" });
    assert.throws(() => new HostSignIn(SignInState.SignedOut, code, null, null), { name: "HostingArgumentException", parameterName: "deviceCode" });
    assert.throws(() => new HostSignIn(SignInState.SignedOut, null, null, null, undefined, address), { name: "HostingArgumentException", parameterName: "address" });
    assert.throws(() => new HostSignIn(SignInState.Waiting, code, null, null, undefined, address), { name: "HostingArgumentException", parameterName: "address" });
    assert.throws(() => HostSignIn.waitingInBrowser("http://login.microsoftonline.com/"), { name: "HostingArgumentException", parameterName: "address" });
    assert.throws(() => new HostSignIn(SignInState.SignedIn, null, null, null), { name: "HostingArgumentException", parameterName: "account" });
    assert.throws(() => new HostSignIn(SignInState.SignedOut, null, account, null), { name: "HostingArgumentException", parameterName: "account" });
    assert.throws(() => new HostSignIn(SignInState.SignedIn, null, account, SignInFailure.Denied),
      { name: "HostingArgumentException", parameterName: "failure", message: "The argument failure is invalid: expected null, since only a sign-out has a failure." });
    assert.throws(() => HostSignIn.fromJson({ state: "Waiting", deviceCode: null, address: null, account: null, failure: null }), { name: "HostingFieldException", field: "$.deviceCode" });
    assert.throws(() => HostSignIn.fromJson({ state: "Waiting", deviceCode: null, address: "ftp://login.microsoftonline.com/", account: null, failure: null }),
      { name: "HostingFieldException", field: "$.address" });
  });

  it("reads a sign-in's JSON without an address, as the published versions write it", () => {
    assert.deepEqual(HostSignIn.fromJson({ state: "SignedOut", deviceCode: null, account: null, failure: "Denied" }), HostSignIn.signedOut(SignInFailure.Denied));
  });

  it("refuses a field it doesn't define, in itself and in its parts", () => {
    const json = HostSignIn.waiting(code).toJson();

    assert.throws(() => HostSignIn.fromJson({ ...json, token: "x" }), HostingFieldException);
    assert.throws(() => HostSignIn.fromJson({ ...json, token: "x" }), { name: "HostingFieldException", field: "$.token" });
    assert.throws(() => HostSignIn.fromJson({ ...json, deviceCode: { ...code.toJson(), interval: 5 } }), { name: "HostingFieldException", field: "$.deviceCode.interval" });
    assert.throws(() => HostSignIn.fromJson({ ...HostSignIn.signedIn(account).toJson(), account: { ...account.toJson(), token: "x" } }), { name: "HostingFieldException", field: "$.account.token" });
  });
});
