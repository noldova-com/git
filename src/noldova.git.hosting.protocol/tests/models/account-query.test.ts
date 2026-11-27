/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { AccountQuery, HostingFieldException } from "../../src/api/index.ts";

describe("AccountQuery", () => {
  it("returns its account as JSON that reads back the same", () => {
    const query: AccountQuery = new AccountQuery(2);

    assert.deepEqual(query.toJson(), { account: 2 });
    assert.deepEqual(AccountQuery.fromJson(JSON.parse(JSON.stringify(query.toJson()))), query);
  });

  it("refuses an account that isn't a positive whole number, naming the parameter", () => {
    for (const account of [0, -1, 1.5])
      assert.throws(() => new AccountQuery(account), { name: "HostingArgumentException", parameterName: "account" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    assert.throws(() => AccountQuery.fromJson({ account: 1, host: "github.com" }), HostingFieldException);
    assert.throws(() => AccountQuery.fromJson({ account: 0 }, "$.query"), { name: "HostingFieldException", field: "$.query.account" });
    assert.throws(() => AccountQuery.fromJson({ account: "1" }), { name: "JsonException", path: "$.account" });
  });
});
