/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostAccountEntry, HostAccountList, HostingFieldException, HostSignIn } from "../../src/api/index.ts";

describe("HostAccountList", () => {
  const entries: readonly HostAccountEntry[] = [new HostAccountEntry(1, HostSignIn.signedOut()), new HostAccountEntry(3, HostSignIn.signedOut())];

  it("returns its accounts in order as JSON that reads back the same", () => {
    const list: HostAccountList = new HostAccountList(entries);

    assert.deepEqual(list.toJson(), { accounts: entries.map(t => t.toJson()) });
    assert.deepEqual(HostAccountList.fromJson(JSON.parse(JSON.stringify(list.toJson()))), list);
    assert.deepEqual(new HostAccountList([]).toJson(), { accounts: [] });
  });

  it("keeps its own copy of the accounts", () => {
    const accounts: HostAccountEntry[] = [...entries];
    const list: HostAccountList = new HostAccountList(accounts);
    accounts.pop();

    assert.equal(list.accounts.length, 2);
  });

  it("refuses an id twice, naming the parameter", () => {
    assert.throws(() => new HostAccountList([...entries, new HostAccountEntry(1, HostSignIn.signedOut())]),
      { name: "HostingArgumentException", parameterName: "accounts" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new HostAccountList(entries).toJson();
    const twice = { accounts: [entries[0]?.toJson(), entries[0]?.toJson()] };

    assert.throws(() => HostAccountList.fromJson({ ...json, first: 1 }), HostingFieldException);
    assert.throws(() => HostAccountList.fromJson(twice, "$.list"), { name: "HostingFieldException", field: "$.list.accounts" });
    assert.throws(() => HostAccountList.fromJson({ accounts: [{ id: 0, signIn: HostSignIn.signedOut().toJson() }] }, "$.list"),
      { name: "HostingFieldException", field: "$.list.accounts.0.id" });
  });
});
