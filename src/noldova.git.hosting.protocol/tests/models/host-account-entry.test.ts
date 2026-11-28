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

  it("writes its place only when it has one, and reads JSON without it, with null or with a place", () => {
    const placed: HostAccountEntry = new HostAccountEntry(2, signedIn, "dev.azure.com/fabrikam");

    assert.deepEqual(placed.toJson(), { id: 2, signIn: signedIn.toJson(), place: "dev.azure.com/fabrikam" });
    assert.deepEqual([
      HostAccountEntry.fromJson({ id: 2, signIn: signedIn.toJson() }).place,
      HostAccountEntry.fromJson({ id: 2, signIn: signedIn.toJson(), place: null }).place,
      HostAccountEntry.fromJson(JSON.parse(JSON.stringify(placed.toJson()))).place,
      HostAccountEntry.fromJson({ id: 2, signIn: signedIn.toJson(), place: "github.example.com:8443" }).place
    ], [null, null, "dev.azure.com/fabrikam", "github.example.com:8443"]);
  });

  it("refuses a place with a scheme, a user name, capitals or a trailing '/', naming the parameter or the field", () => {
    for (const place of ["https://dev.azure.com/fabrikam", "user@dev.azure.com/fabrikam", "dev.azure.com/Fabrikam", "dev.azure.com/fabrikam/", ""])
      assert.throws(() => new HostAccountEntry(2, signedIn, place), { name: "HostingArgumentException", parameterName: "place" }, place);
    assert.throws(() => HostAccountEntry.fromJson({ id: 2, signIn: signedIn.toJson(), place: "dev.azure.com/" }, "$.entry"),
      { name: "HostingFieldException", field: "$.entry.place" });
  });

  it("refuses an id that isn't a positive whole number, naming the parameter", () => {
    assert.throws(() => new HostAccountEntry(0, signedIn), { name: "HostingArgumentException", parameterName: "id" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new HostAccountEntry(1, signedIn).toJson();

    assert.throws(() => HostAccountEntry.fromJson({ ...json, login: "octocat" }), HostingFieldException);
    assert.throws(() => HostAccountEntry.fromJson({ ...json, id: -2 }, "$.entry"), { name: "HostingFieldException", field: "$.entry.id" });
    assert.throws(() => HostAccountEntry.fromJson({ ...json, signIn: { ...signedIn.toJson(), account: null } }, "$.entry"),
      { name: "HostingFieldException", field: "$.entry.signIn.account" });
    assert.throws(() => HostAccountEntry.fromJson({ ...json, signIn: null }), { name: "JsonException", path: "$.signIn" });
  });
});
