/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingArgumentException, HostingFieldException, HostReference } from "../../src/api/index.ts";

const reference: HostReference = new HostReference("git-github", "team", "repo", 7);

describe("HostReference", () => {
  it("keeps its parts as given", () => {
    assert.deepEqual([reference.host, reference.owner, reference.repository, reference.number], ["git-github", "team", "repo", 7]);
  });

  it("writes itself as the owner, the repository and the number", () => {
    assert.equal(reference.text, "team/repo#7");
  });

  it("returns its parts as JSON that reads back the same", () => {
    const json = reference.toJson();

    assert.deepEqual(json, { host: "git-github", owner: "team", repository: "repo", number: 7 });
    assert.deepEqual(HostReference.fromJson(JSON.parse(JSON.stringify(json))), reference);
  });

  it("writes its place only when it has one, and reads JSON without it, with null or with a place", () => {
    const placed: HostReference = new HostReference("git-github", "team", "repo", 7, "github.example.com");

    assert.deepEqual([reference.place, placed.toJson()], [null, { host: "git-github", owner: "team", repository: "repo", number: 7, place: "github.example.com" }]);
    assert.deepEqual([
      HostReference.fromJson({ ...reference.toJson(), place: null }).place,
      HostReference.fromJson(JSON.parse(JSON.stringify(placed.toJson()))).place,
      HostReference.fromJson({ ...reference.toJson(), place: "github.example.com:8443" }).place
    ], [null, "github.example.com", "github.example.com:8443"]);
  });

  it("refuses a place with a scheme, a user name, capitals or a trailing '/', naming the parameter or the field", () => {
    for (const place of ["https://github.example.com", "user@github.example.com", "GitHub.example.com", "github.example.com/", ""])
      assert.throws(() => new HostReference("git-github", "team", "repo", 7, place), { name: "HostingArgumentException", parameterName: "place" }, place);
    assert.throws(() => HostReference.fromJson({ ...reference.toJson(), place: "github.example.com/" }, "$.reference"),
      { name: "HostingFieldException", field: "$.reference.place" });
  });

  it("takes an owner of nested groups, and refuses '.', '..' and characters outside a host's names in the owner or the repository", () => {
    const nested: HostReference = new HostReference("git-gitlab", "octocat/tools.v2", "hello_world-1.0", 7);

    assert.deepEqual(HostReference.fromJson(nested.toJson()), nested);
    for (const owner of ["..", ".", "octocat/..", "../user", "octocat/", "/octocat", "octo cat", "octocat%2F..", "octocat\\user"])
      assert.throws(() => new HostReference("git-github", owner, "git", 7), { name: "HostingArgumentException", parameterName: "owner" }, owner);
    for (const repository of ["..", ".", "hello/world", "hello world", "hello?world"])
      assert.throws(() => new HostReference("git-github", "octocat", repository, 7), { name: "HostingArgumentException", parameterName: "repository" }, repository);
    assert.throws(() => new HostReference("git-github", "octocat", "..", 7),
      { name: "HostingArgumentException", parameterName: "repository", message: "The argument repository is invalid: expected a name of letters, digits, '.', '_' and '-', other than '.' and '..'." });
    assert.throws(() => HostReference.fromJson({ host: "git-github", owner: "../user", repository: "git", number: 7 }), { name: "HostingFieldException", field: "$.owner" });
  });

  it("refuses a blank host, owner or repository and a number that isn't a whole number above zero, naming the parameter", () => {
    assert.throws(() => new HostReference(" ", "team", "repo", 7), HostingArgumentException);
    assert.throws(() => new HostReference(" ", "team", "repo", 7),
      { name: "HostingArgumentException", parameterName: "host", message: "The argument host is invalid: expected a text that isn't blank." });
    assert.throws(() => new HostReference("git-github", "", "git", 7), { name: "HostingArgumentException", parameterName: "owner" });
    assert.throws(() => new HostReference("git-github", "team", "\t", 7), { name: "HostingArgumentException", parameterName: "repository" });
    assert.throws(() => new HostReference("git-github", "team", "repo", 0),
      { name: "HostingArgumentException", parameterName: "number", message: "The argument number is invalid: expected a whole number above zero." });
    assert.throws(() => new HostReference("git-github", "team", "repo", -1.5), { name: "HostingArgumentException", parameterName: "number" });
    assert.throws(() => new HostReference("git-github", "team", "repo", Number.MAX_SAFE_INTEGER + 1), { name: "HostingArgumentException", parameterName: "number" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = reference.toJson();

    assert.throws(() => HostReference.fromJson({ ...json, title: "x" }), HostingFieldException);
    assert.throws(() => HostReference.fromJson({ ...json, title: "x" }),
      { name: "HostingFieldException", field: "$.title", message: "The field $.title is invalid: expected none, since the model doesn't define it." });
    assert.throws(() => HostReference.fromJson({ ...json, host: "" }, "$.reference"), { name: "HostingFieldException", field: "$.reference.host" });
    assert.throws(() => HostReference.fromJson({ ...json, owner: " " }), { name: "HostingFieldException", field: "$.owner" });
    assert.throws(() => HostReference.fromJson({ ...json, repository: "" }), { name: "HostingFieldException", field: "$.repository" });
    assert.throws(() => HostReference.fromJson({ ...json, number: 0 }), { name: "HostingFieldException", field: "$.number" });
  });

  it("refuses JSON that isn't an object or whose field is missing or of another type", () => {
    const json = reference.toJson();

    assert.throws(() => HostReference.fromJson([]), { name: "JsonException" });
    assert.throws(() => HostReference.fromJson({ host: "git-github", owner: "team", repository: "repo" }), { name: "JsonException", path: "$.number" });
    assert.throws(() => HostReference.fromJson({ ...json, number: "7" }), { name: "JsonException", path: "$.number" });
  });
});
