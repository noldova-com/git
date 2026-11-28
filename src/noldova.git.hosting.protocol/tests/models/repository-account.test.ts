/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, RepositoryAccount } from "../../src/api/index.ts";

describe("RepositoryAccount", () => {
  it("returns its account, or null, as JSON that reads back the same", () => {
    for (const account of [2, null]) {
      const answer: RepositoryAccount = new RepositoryAccount(account);

      assert.deepEqual(answer.toJson(), { account });
      assert.deepEqual(RepositoryAccount.fromJson(JSON.parse(JSON.stringify(answer.toJson()))), answer);
    }
  });

  it("says the remote's user name chose the account only when it did, writing the field only then", () => {
    const named: RepositoryAccount = new RepositoryAccount(2, undefined, true);

    assert.deepEqual([named.isNamedByRemote, new RepositoryAccount(2).isNamedByRemote], [true, false]);
    assert.deepEqual(named.toJson(), { account: 2, isNamedByRemote: true });
    assert.deepEqual(RepositoryAccount.fromJson(JSON.parse(JSON.stringify(named.toJson()))), named);
    assert.equal(RepositoryAccount.fromJson({ account: 2, isNamedByRemote: false }).isNamedByRemote, false);
  });

  it("refuses an account that isn't a positive whole number, or a user name's choice without an account, naming the parameter", () => {
    assert.throws(() => new RepositoryAccount(0), { name: "HostingArgumentException", parameterName: "account" });
    assert.throws(() => new RepositoryAccount(null, undefined, true), { name: "HostingArgumentException", parameterName: "isNamedByRemote" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    assert.throws(() => RepositoryAccount.fromJson({ account: 1, login: "octocat" }), HostingFieldException);
    assert.throws(() => RepositoryAccount.fromJson({ account: -1 }, "$.answer"), { name: "HostingFieldException", field: "$.answer.account" });
    assert.throws(() => RepositoryAccount.fromJson({}), { name: "JsonException", path: "$.account" });
    assert.throws(() => RepositoryAccount.fromJson({ account: null, isNamedByRemote: true }), { name: "HostingFieldException", field: "$.isNamedByRemote" });
    assert.throws(() => RepositoryAccount.fromJson({ account: 1, isNamedByRemote: "yes" }), { name: "JsonException", path: "$.isNamedByRemote" });
  });
});
