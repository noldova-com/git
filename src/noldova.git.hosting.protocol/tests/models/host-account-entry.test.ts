/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostAccount, HostAccountEntry, HostingFieldException, HostSignIn } from "../../src/api/index.ts";

describe("HostAccountEntry", () => {
  const signedIn: HostSignIn = HostSignIn.signedIn(new HostAccount("octocat", null, null, ["repo"]));

  it("returns its id and sign-in as JSON that reads back the same", () => {
    const entry: HostAccountEntry = new HostAccountEntry(2, signedIn);

    assert.deepEqual(entry.toJson(), { id: 2, signIn: signedIn.toJson() });
    assert.deepEqual(HostAccountEntry.fromJson(JSON.parse(JSON.stringify(entry.toJson()))), entry);
  });

  it("names the server of an account on another server than the module's own, writing the field only then", () => {
    const entry: HostAccountEntry = new HostAccountEntry(3, signedIn, undefined, "github.example.com:8443");

    assert.deepEqual([entry.host, new HostAccountEntry(2, signedIn).host], ["github.example.com:8443", null]);
    assert.deepEqual(entry.toJson(), { id: 3, signIn: signedIn.toJson(), host: "github.example.com:8443" });
    assert.deepEqual(HostAccountEntry.fromJson(JSON.parse(JSON.stringify(entry.toJson()))), entry);
  });

  it("refuses an id that isn't a positive whole number, or a server that isn't a lowercase name with an optional port, naming the parameter", () => {
    assert.throws(() => new HostAccountEntry(0, signedIn), { name: "HostingArgumentException", parameterName: "id" });
    for (const host of ["", "GitHub.example.com", "https://github.example.com", "github.example.com/", "-github.example.com", "github.example.com:0",
      "github..example.com"])
      assert.throws(() => new HostAccountEntry(2, signedIn, undefined, host), { name: "HostingArgumentException", parameterName: "host" }, host);
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new HostAccountEntry(1, signedIn).toJson();

    assert.throws(() => HostAccountEntry.fromJson({ ...json, login: "octocat" }), HostingFieldException);
    assert.throws(() => HostAccountEntry.fromJson({ ...json, id: -2 }, "$.entry"), { name: "HostingFieldException", field: "$.entry.id" });
    assert.throws(() => HostAccountEntry.fromJson({ ...json, signIn: { ...signedIn.toJson(), account: null } }, "$.entry"),
      { name: "HostingFieldException", field: "$.entry.signIn.account" });
    assert.throws(() => HostAccountEntry.fromJson({ ...json, signIn: null }), { name: "JsonException", path: "$.signIn" });
    assert.throws(() => HostAccountEntry.fromJson({ ...json, host: "a b" }, "$.entry"), { name: "HostingFieldException", field: "$.entry.host" });
    assert.throws(() => HostAccountEntry.fromJson({ ...json, host: null }), { name: "JsonException", path: "$.host" });
  });
});
