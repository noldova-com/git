/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { AccountPick, HostingFieldException } from "../../src/api/index.ts";

describe("AccountPick", () => {
  it("returns its host, path and account as JSON that reads back the same", () => {
    const pick: AccountPick = new AccountPick("github.com", "octocat/hello-world", 2);

    assert.deepEqual(pick.toJson(), { host: "github.com", path: "octocat/hello-world", account: 2 });
    assert.deepEqual(AccountPick.fromJson(JSON.parse(JSON.stringify(pick.toJson()))), pick);
  });

  it("refuses a blank host, a path with a '..' name or an account that isn't positive, naming the parameter", () => {
    assert.throws(() => new AccountPick(" ", "octocat/hello-world", 1), { name: "HostingArgumentException", parameterName: "host" });
    assert.throws(() => new AccountPick("github.com", "octocat/..", 1), { name: "HostingArgumentException", parameterName: "path" });
    assert.throws(() => new AccountPick("github.com", "octocat/hello-world", 0), { name: "HostingArgumentException", parameterName: "account" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new AccountPick("github.com", "octocat/hello-world", 1).toJson();

    assert.throws(() => AccountPick.fromJson({ ...json, login: "octocat" }), HostingFieldException);
    assert.throws(() => AccountPick.fromJson({ ...json, account: 0 }, "$.pick"), { name: "HostingFieldException", field: "$.pick.account" });
    assert.throws(() => AccountPick.fromJson({ ...json, path: null }), { name: "JsonException", path: "$.path" });
  });
});
