/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitHooks } from "../../src/models/git-hooks.ts";

describe("GitHooks", () => {
  it("keeps the hooks that will run, none included, and reads back the same", () => {
    const hooks = new GitHooks(["post-merge", "reference-transaction"]);
    const none = new GitHooks([]);

    assert.deepEqual(hooks.toJson(), { hooks: ["post-merge", "reference-transaction"] });
    assert.deepEqual(GitHooks.fromJson(JSON.parse(JSON.stringify(hooks.toJson()))), hooks);
    assert.deepEqual(GitHooks.fromJson(none.toJson()), none);
  });

  it("refuses an empty or non-text hook, a missing list and an unknown field, naming its path", () => {
    assert.throws(() => new GitHooks(["post-merge", ""]), { name: "ProtocolFieldException", field: "hooks.1" });
    assert.throws(() => GitHooks.fromJson({ hooks: [""] }), { name: "ProtocolFieldException", field: "$.hooks.0" });
    assert.throws(() => GitHooks.fromJson({ hooks: [1] }), { name: "JsonException", path: "$.hooks.0" });
    assert.throws(() => GitHooks.fromJson({}), { name: "JsonException", path: "$.hooks" });
    assert.throws(() => GitHooks.fromJson({ hooks: [], names: [] }), { name: "ProtocolFieldException", field: "$.names" });
  });
});
