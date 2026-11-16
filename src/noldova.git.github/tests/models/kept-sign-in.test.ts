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

import { KeptSignIn } from "../../src/models/kept-sign-in.ts";

describe("KeptSignIn", () => {
  it("writes the token with the account, and reads it back", () => {
    const kept = new KeptSignIn("gho_token", new HostAccount("octocat", "The Octocat", null, ["repo"]));

    const json = kept.toJson();

    assert.deepEqual(json, { token: "gho_token", account: { login: "octocat", name: "The Octocat", avatar: null, scopes: ["repo"] } });
    assert.deepEqual(KeptSignIn.fromJson(json), kept);
  });

  it("reads an account kept with its avatar's address, as 0.0.5 kept it, and keeps no avatar", () => {
    const kept = KeptSignIn.fromJson({ token: "gho_token", account: { login: "octocat", name: null, avatarUrl: "https://avatars.githubusercontent.com/u/583231",
      scopes: [] } });

    assert.deepEqual(kept, new KeptSignIn("gho_token", new HostAccount("octocat", null, null, [])));
  });

  it("refuses a kept value with no account, a blank token or a blank login, naming the field", () => {
    const values: readonly unknown[] = [{ token: "gho_token" }, { token: " ", account: { login: "octocat", name: null, scopes: [] } },
      { token: "gho_token", account: { login: " ", name: null, scopes: [] } }, "gho_token"];

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

    assert.deepEqual(paths, ["$.account", "$.token", "$.account.login", "$"]);
  });
});
