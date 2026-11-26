/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { RefKind } from "../../src/enums/ref-kind.ts";
import { GitRef } from "../../src/models/git-ref.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitRef", () => {
  it("keeps its kind and short name, and reads back the same for each kind", () => {
    const refs = [new GitRef(RefKind.Head, ""), new GitRef(RefKind.Branch, "main"), new GitRef(RefKind.RemoteBranch, "origin/main"), new GitRef(RefKind.Tag, "v1.2.0")];

    assert.deepEqual(refs.map(t => t.toJson()),
      [{ kind: "Head", name: "" }, { kind: "Branch", name: "main" }, { kind: "RemoteBranch", name: "origin/main" }, { kind: "Tag", name: "v1.2.0" }]);
    for (const ref of refs)
      assert.deepEqual(GitRef.fromJson(JSON.parse(JSON.stringify(ref.toJson()))), ref);
  });

  it("refuses an empty name on any kind but Head, and a name that isn't one line, naming its path", () => {
    const line = "a line of at most 1000 characters without a control character";

    assert.throws(() => GitRef.fromJson({ kind: "Branch", name: "" }), expected("$.name", "a name for a branch or tag"));
    assert.throws(() => new GitRef(RefKind.RemoteBranch, ""), expected("name", "a name for a branch or tag"));
    assert.throws(() => new GitRef(RefKind.Tag, ""), expected("name", "a name for a branch or tag"));
    assert.throws(() => GitRef.fromJson({ kind: "Tag", name: "a\nb" }), expected("$.name", line));
    assert.throws(() => new GitRef(RefKind.Head, "\u0007"), expected("name", line));
    assert.throws(() => new GitRef(RefKind.Branch, "x".repeat(1001)), expected("name", line));
  });

  it("refuses an unknown kind, a missing name and a field it doesn't define", () => {
    assert.throws(() => GitRef.fromJson({ kind: "Stash", name: "s" }), { name: "JsonException", path: "$.kind" });
    assert.throws(() => GitRef.fromJson({ kind: "Tag" }), { name: "JsonException", path: "$.name" });
    assert.throws(() => GitRef.fromJson({ kind: "Tag", name: "v1", more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
