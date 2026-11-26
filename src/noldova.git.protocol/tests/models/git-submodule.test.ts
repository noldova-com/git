/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitSubmodule } from "../../src/models/git-submodule.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitSubmodule", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its path and recorded commit, and reads back the same", () => {
    const submodule = new GitSubmodule("lib/sub", id);

    assert.deepEqual(submodule.toJson(), { path: "lib/sub", id });
    assert.deepEqual(GitSubmodule.fromJson(JSON.parse(JSON.stringify(submodule.toJson()))), submodule);
    assert.equal(new GitSubmodule("..sub/x..", id).path, "..sub/x..");
  });

  it("refuses a path that is empty, absolute, starts with a drive, has a .. segment or a NUL, naming its path", () => {
    const relative = "a relative path of 1 to 4096 characters, not starting with a drive and colon, a colon or a backslash, without a .. segment or a NUL character";

    assert.throws(() => GitSubmodule.fromJson({ path: "", id }), expected("$.path", relative));
    assert.throws(() => GitSubmodule.fromJson({ path: "/lib/sub", id }), expected("$.path", relative));
    assert.throws(() => new GitSubmodule("C:sub", id), expected("path", relative));
    assert.throws(() => new GitSubmodule("lib/../sub", id), expected("path", relative));
    assert.throws(() => new GitSubmodule("lib\\..\\sub", id), expected("path", relative));
    assert.throws(() => new GitSubmodule("lib\u0000sub", id), expected("path", relative));
  });

  it("refuses an id that isn't a full object id and a field it doesn't define", () => {
    assert.throws(() => GitSubmodule.fromJson({ path: "lib/sub", id: "0123456" }), expected("$.id", "a full hexadecimal object id"));
    assert.throws(() => GitSubmodule.fromJson({ path: "lib/sub" }), { name: "JsonException", path: "$.id" });
    assert.throws(() => GitSubmodule.fromJson({ path: "lib/sub", id, more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
