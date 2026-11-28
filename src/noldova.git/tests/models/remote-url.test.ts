/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, onTestFinished, test, vi } from "vitest";

import { RemoteTransport } from "@noldova/git.protocol";

import { RemoteUrl } from "../../src/models/remote-url.ts";

describe("RemoteUrl", () => {
  const read = (url: string): unknown => RemoteUrl.toRemote("origin", url).toJson();

  test("reads the host and path of HTTPS and SSH URLs and of scp-style addresses, never the name, token or port before or beside the host", () => {
    assert.deepEqual(read("https://host.example/team/repo.git"), { name: "origin", host: "host.example", path: "team/repo", transport: RemoteTransport.Https });
    assert.deepEqual(read("http://person:token@Example.COM:8080/a/b/"), { name: "origin", host: "example.com", path: "a/b", transport: RemoteTransport.Https });
    assert.deepEqual(read("ssh://git@host.example:22/team/repo.git"), { name: "origin", host: "host.example", path: "team/repo", transport: RemoteTransport.Ssh });
    assert.deepEqual(read("git+ssh://host/team/repo"), { name: "origin", host: "host", path: "team/repo", transport: RemoteTransport.Ssh });
    assert.deepEqual(read("git@host.example:team/repo.git"), { name: "origin", host: "host.example", path: "team/repo", transport: RemoteTransport.Ssh });
    assert.deepEqual(read("host:team/repo.GIT"), { name: "origin", host: "host", path: "team/repo", transport: RemoteTransport.Ssh });
    assert.deepEqual(read("git://host/a%20b/repo"), { name: "origin", host: "host", path: "a b/repo", transport: RemoteTransport.Other });
  });

  test("names no host or path for a local remote, a file URL, a drive path or a URL it can't read", () => {
    for (const url of ["/srv/repo.git", "../repo", "./dir:name", "C:\\repos\\one", "D:/repos/two", "file:///srv/repo.git"])
      assert.deepEqual(read(url), { name: "origin", host: null, path: null, transport: RemoteTransport.File }, url);
    assert.deepEqual(read("https://exa mple.com/a"), { name: "origin", host: null, path: null, transport: RemoteTransport.Other });
  });

  test("leaves out a host or path the protocol refuses, also one with an empty, . or .. segment, and keeps a path whose escapes don't decode", () => {
    assert.deepEqual(read("ssh://[::1]/a/b"), { name: "origin", host: null, path: "a/b", transport: RemoteTransport.Ssh });
    assert.deepEqual(read("https://host/"), { name: "origin", host: "host", path: null, transport: RemoteTransport.Https });
    assert.deepEqual(read("https://host/a/.git"), { name: "origin", host: "host", path: "a", transport: RemoteTransport.Https });
    assert.deepEqual(read("https://host/a%40b/c"), { name: "origin", host: "host", path: null, transport: RemoteTransport.Https });
    assert.deepEqual(read("https://host/a%zz"), { name: "origin", host: "host", path: "a%zz", transport: RemoteTransport.Https });
    for (const url of ["https://host/a//b", "host:team/../repo", "host:a/%2E/b", "host:a\\.\\b"])
      assert.equal(RemoteUrl.toRemote("origin", url).path, null, url);
  });

  test("reads the user name of an HTTPS URL, decoded, and none from SSH, scp-style, local or unreadable addresses, nor one with a space, a colon or a control character", () => {
    assert.deepEqual(["https://Kim@github.com/a/b", "http://kim:secret@host/a", "https://kim%40example.com@dev.azure.com/o/p/_git/r"].map(t => RemoteUrl.userOf(t)),
      ["Kim", "kim", "kim@example.com"]);
    for (const url of ["https://github.com/a/b", "ssh://kim@host/a/b", "kim@host:a/b", "/srv/repo.git", "https://kim@exa mple.com/a", "https://%zz@host/a",
      "https://a%20b@host/a", "https://a%3Ab@host/a", "https://a%0Ab@host/a", `https://${"k".repeat(257)}@host/a`])
      assert.equal(RemoteUrl.userOf(url), null, url);
  });

  test("lets through a failure to read a URL or its path other than one it can't read", () => {
    const failure = new RangeError("The reader broke.");
    const parse = vi.spyOn(globalThis, "URL").mockImplementationOnce(function () {
      throw failure;
    });
    onTestFinished(() => parse.mockRestore());
    assert.throws(() => RemoteUrl.toRemote("origin", "https://host/a"), failure);

    const decode = vi.spyOn(globalThis, "decodeURIComponent").mockImplementationOnce(() => {
      throw failure;
    });
    onTestFinished(() => decode.mockRestore());
    assert.throws(() => RemoteUrl.toRemote("origin", "https://host/a"), failure);

    const user = vi.spyOn(globalThis, "decodeURIComponent").mockImplementationOnce(() => {
      throw failure;
    });
    onTestFinished(() => user.mockRestore());
    assert.throws(() => RemoteUrl.userOf("https://kim@host/a"), failure);
  });
});
