/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { GitRepositoryItems } from "../../src/models/git-repository-items.ts";
import { GitStash } from "../../src/models/git-stash.ts";
import { GitSubmodule } from "../../src/models/git-submodule.ts";
import { GitTag } from "../../src/models/git-tag.ts";

describe("GitRepositoryItems", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its tags, stashes, submodules and whether a list was cut, and reads back the same", () => {
    const items = new GitRepositoryItems([new GitTag("v1.2.0", id)], [new GitStash(0, "WIP on main", id)], [new GitSubmodule("vendor/lib", id)], true);

    assert.deepEqual(items.toJson(), {
      tags: [{ name: "v1.2.0", id }],
      stashes: [{ index: 0, message: "WIP on main", id }],
      submodules: [{ path: "vendor/lib", id }],
      truncated: true
    });
    assert.deepEqual(GitRepositoryItems.fromJson(JSON.parse(JSON.stringify(items.toJson()))), items);
  });

  it("refuses an empty or multi-line tag name, a negative stash index, a stash message of more than one line, an absolute submodule path and a short id, naming its path", () => {
    const json = { tags: [], stashes: [], submodules: [], truncated: false };

    assert.throws(() => new GitTag("", id), { name: "ProtocolFieldException", field: "name" });
    assert.throws(() => GitRepositoryItems.fromJson({ ...json, tags: [{ name: "a\nb", id }] }), { name: "ProtocolFieldException", field: "$.tags.0.name" });
    assert.throws(() => GitRepositoryItems.fromJson({ ...json, tags: [{ name: "v1", id: "0123" }] }), { name: "ProtocolFieldException", field: "$.tags.0.id" });
    assert.throws(() => GitRepositoryItems.fromJson({ ...json, stashes: [{ index: -1, message: "m", id }] }), { name: "ProtocolFieldException", field: "$.stashes.0.index" });
    assert.throws(() => GitRepositoryItems.fromJson({ ...json, stashes: [{ index: 0, message: "a\nb", id }] }), { name: "ProtocolFieldException", field: "$.stashes.0.message" });
    assert.throws(() => GitRepositoryItems.fromJson({ ...json, stashes: [{ index: 0, message: "m", id: "x" }] }), { name: "ProtocolFieldException", field: "$.stashes.0.id" });
    assert.throws(() => GitRepositoryItems.fromJson({ ...json, submodules: [{ path: "/abs", id }] }), { name: "ProtocolFieldException", field: "$.submodules.0.path" });
    assert.throws(() => GitRepositoryItems.fromJson({ ...json, submodules: [{ path: "lib", id: "x" }] }), { name: "ProtocolFieldException", field: "$.submodules.0.id" });
  });

  it("refuses an unknown or missing field", () => {
    assert.throws(() => GitRepositoryItems.fromJson({ tags: [], stashes: [], submodules: [], truncated: false, more: 1 }), { name: "ProtocolFieldException" });
    assert.throws(() => GitRepositoryItems.fromJson({ tags: [], stashes: [], submodules: [] }), { name: "JsonException", path: "$.truncated" });
    assert.throws(() => GitRepositoryItems.fromJson({ tags: [{ name: "v1", id, kind: "Tag" }], stashes: [], submodules: [], truncated: false }), { name: "ProtocolFieldException" });
    assert.throws(() => GitRepositoryItems.fromJson({ tags: [], stashes: [{ index: 0, message: "m", id, ref: "s" }], submodules: [], truncated: false }), { name: "ProtocolFieldException" });
    assert.throws(() => GitRepositoryItems.fromJson({ tags: [], stashes: [], submodules: [{ path: "lib", id, url: "u" }], truncated: false }), { name: "ProtocolFieldException" });
  });
});
