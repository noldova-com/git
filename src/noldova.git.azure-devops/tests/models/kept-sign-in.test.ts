/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonException } from "@noldova/context.json";
import { HostAccount } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { SignInKind } from "../../src/enums/sign-in-kind.ts";
import { KeptSignIn } from "../../src/models/kept-sign-in.ts";

describe("KeptSignIn", () => {
  it("writes the token with its organization and the account, and reads it back", () => {
    const kept = new KeptSignIn(SignInKind.Token, "azure-token", "fabrikam", new HostAccount("monalisa@fabrikam.com", "Mona Lisa", null, []));

    const json = kept.toJson();

    assert.deepEqual(json, { kind: "token", token: "azure-token", organization: "fabrikam", account: { login: "monalisa@fabrikam.com", name: "Mona Lisa", avatar: null, scopes: [] } });
    assert.deepEqual(KeptSignIn.fromJson(json), kept);
  });

  it("keeps a Microsoft sign-in's refresh token, and reads a value kept before the kind as a token sign-in", () => {
    const account = { login: "monalisa@fabrikam.com", name: null, avatar: null, scopes: [] };
    const microsoft = new KeptSignIn(SignInKind.Microsoft, "refresh-token", "fabrikam", HostAccount.fromJson(account));

    assert.deepEqual([KeptSignIn.fromJson(microsoft.toJson()), KeptSignIn.fromJson({ token: "azure-token", organization: "fabrikam", account }).kind],
      [microsoft, SignInKind.Token]);
    assert.throws(() => KeptSignIn.fromJson({ kind: "password", token: "azure-token", organization: "fabrikam", account }), JsonException);
  });

  it("refuses a kept value with no organization or account, a blank token or a blank login, naming the field", () => {
    const account = { login: "monalisa@fabrikam.com", name: null, scopes: [] };
    const values: readonly unknown[] = [{ token: "azure-token", account }, { token: "azure-token", organization: "fabrikam" },
      { token: " ", organization: "fabrikam", account }, { token: "azure-token", organization: "fabrikam", account: { ...account, login: " " } }, "azure-token"];

    const paths: (string | null)[] = [];
    for (const value of values) {
      try {
        KeptSignIn.fromJson(value);
        paths.push(null);
      }
      catch (error) {
        assert.ok(error instanceof JsonException);
        paths.push(error.path);
      }
    }

    assert.deepEqual(paths, ["$.organization", "$.account", "$.token", "$.account.login", "$"]);
  });
});
