/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitFolderBinding } from "../../src/models/git-folder-binding.ts";

describe("GitFolderBinding", () => {
  it("keeps the session's folder, and reads it back from bindings that hold other modules' bindings too", () => {
    const binding = new GitFolderBinding("/home/sample/repo");

    assert.deepEqual(binding.toJson(), { "git.folder": "/home/sample/repo" });
    assert.deepEqual(GitFolderBinding.fromBindings({ ...binding.toJson(), "terminal.folder": "/tmp" }), binding);
    assert.equal(GitFolderBinding.fromBindings({ "git.folder": "C:\\work\\repo" }).folder, "C:\\work\\repo");
    assert.equal(GitFolderBinding.fromBindings({ "git.folder": "\\\\server\\share\\repo" }).folder, "\\\\server\\share\\repo");
  });

  it("refuses a relative or too long folder, a missing binding and bindings that aren't an object, naming its path", () => {
    assert.throws(() => new GitFolderBinding("repo"),
      { name: "ProtocolFieldException", field: "git.folder", message: "The field git.folder is invalid: expected an absolute path of at most 4096 characters." });
    assert.throws(() => GitFolderBinding.fromBindings({ "git.folder": `/${"a".repeat(4096)}` }, "$.bindings"), { name: "ProtocolFieldException", field: "$.bindings.git.folder" });
    assert.throws(() => GitFolderBinding.fromBindings({ "terminal.folder": "/tmp" }), { name: "JsonException", path: '$["git.folder"]' });
    assert.throws(() => GitFolderBinding.fromBindings({ "git.folder": 1 }), { name: "JsonException" });
    assert.throws(() => GitFolderBinding.fromBindings([]), { name: "JsonException" });
  });
});
