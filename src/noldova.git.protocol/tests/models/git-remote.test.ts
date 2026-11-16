/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { RemoteTransport } from "../../src/enums/remote-transport.ts";
import { GitRemote } from "../../src/models/git-remote.ts";

describe("GitRemote", () => {
  it("keeps its name, host, path and transport, and reads back the same", () => {
    const remote = new GitRemote("origin", "host.example", "team/repo", RemoteTransport.Ssh);

    assert.deepEqual(remote.toJson(), { name: "origin", host: "host.example", path: "team/repo", transport: "Ssh" });
    assert.deepEqual(GitRemote.fromJson(JSON.parse(JSON.stringify(remote.toJson()))), remote);
  });

  it("may have no host and no path", () => {
    const remote = new GitRemote("backup", null, null, RemoteTransport.Other);

    assert.deepEqual(remote.toJson(), { name: "backup", host: null, path: null, transport: "Other" });
    assert.deepEqual(GitRemote.fromJson(remote.toJson()), remote);
  });

  it("takes a bare host and a repository path, such as an Azure DevOps one", () => {
    const remote = new GitRemote("origin", "dev.azure.com", "org/project/_git/repo", RemoteTransport.Https);

    assert.deepEqual(GitRemote.fromJson(remote.toJson()), remote);
  });

  it("refuses a host that isn't a bare host name, so no credential, port or URL crosses the wire", () => {
    const expected = { name: "ProtocolFieldException", field: "host", message: "The field host is invalid: expected a bare host name, without userinfo, a port, a path, a query or a space." };

    for (const host of ["x-access-token:secret@github.com", "git@github.com", "github.com:22", "https://github.com", "github.com/o", "github.com?a", "github.com#a", "git hub.com"])
      assert.throws(() => new GitRemote("origin", host, null, RemoteTransport.Https), expected);
    assert.throws(() => GitRemote.fromJson({ name: "origin", host: "user@host", path: null, transport: "Ssh" }, "$.remote"), { name: "ProtocolFieldException", field: "$.remote.host" });
  });

  it("refuses a path with a scheme, userinfo, a query, a fragment or a leading slash", () => {
    const expected = { name: "ProtocolFieldException", field: "path", message: "The field path is invalid: expected a repository path without a scheme, userinfo, a query, a fragment, a leading / or an empty, . or .. segment." };

    for (const path of ["https://user:pw@host/o/r", "user:pw@host/o/r", "o/r@x", "o/r?token=x", "o/r#x", "/o/r"])
      assert.throws(() => new GitRemote("origin", "github.com", path, RemoteTransport.Https), expected);
    assert.throws(() => GitRemote.fromJson({ name: "origin", host: null, path: "/o/r", transport: "File" }, "$.remote"), { name: "ProtocolFieldException", field: "$.remote.path" });
  });

  it("refuses a path with an empty, . or .. segment, by either separator and with %2e for a dot, so it can't climb to another path on the host", () => {
    const expected = { name: "ProtocolFieldException", field: "path", message: "The field path is invalid: expected a repository path without a scheme, userinfo, a query, a fragment, a leading / or an empty, . or .. segment." };

    for (const path of ["../user", "o/../user", "o/r/..", "./r", "o/./r", "o//r", "o/r/", "o\\..\\user", "o/%2e%2e/user", "o/%2E./user", "o/.%2e", "%2e/r"])
      assert.throws(() => new GitRemote("origin", "github.com", path, RemoteTransport.Https), expected, path);
    assert.throws(() => GitRemote.fromJson({ name: "origin", host: "github.com", path: "../user", transport: "Https" }, "$.remote"), { name: "ProtocolFieldException", field: "$.remote.path" });
  });

  it("keeps dots inside a segment's name", () => {
    for (const path of ["o/r.js", "o/.github", "o/r..x", "o/...", "o/%2e%2ex"])
      assert.equal(new GitRemote("origin", "github.com", path, RemoteTransport.Https).path, path);
  });

  it("refuses an empty name, host or path, an unknown transport, a missing field and an unknown field, naming its path", () => {
    assert.throws(() => new GitRemote("", null, null, RemoteTransport.File), { name: "ProtocolFieldException", field: "name", message: "The field name is invalid: expected a text that isn't empty." });
    assert.throws(() => new GitRemote("origin", "", null, RemoteTransport.Https), { name: "ProtocolFieldException", field: "host" });
    assert.throws(() => new GitRemote("origin", "github.com", "", RemoteTransport.Https), { name: "ProtocolFieldException", field: "path" });
    assert.throws(() => GitRemote.fromJson({ name: "origin", host: "", path: null, transport: "Https" }, "$.remote"), { name: "ProtocolFieldException", field: "$.remote.host" });
    assert.throws(() => GitRemote.fromJson({ name: "origin", host: null, path: null, transport: "Git" }), { name: "JsonException", path: "$.transport" });
    assert.throws(() => GitRemote.fromJson({ name: "origin", host: null, transport: "Ssh" }), { name: "JsonException", path: "$.path" });
    assert.throws(() => GitRemote.fromJson({ name: "origin", host: null, path: null, transport: "Ssh", url: "x" }), { name: "ProtocolFieldException", field: "$.url" });
  });
});
