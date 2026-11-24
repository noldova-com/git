/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitAvatarParams } from "../../src/models/git-avatar-params.ts";

describe("GitAvatarParams", () => {
  it("keeps its email as written, and reads back the same", () => {
    const params = new GitAvatarParams("Kim.Lee@Example.com ");

    assert.deepEqual(params.toJson(), { email: "Kim.Lee@Example.com " });
    assert.deepEqual(GitAvatarParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses an empty email, one over a line or with a control character, a missing email and an unknown field, naming its path", () => {
    assert.throws(() => new GitAvatarParams(""), { name: "ProtocolFieldException", field: "email", message: "The field email is invalid: expected a text that isn't empty." });
    assert.throws(() => new GitAvatarParams("a\nb@example.com"), { name: "ProtocolFieldException", field: "email" });
    assert.throws(() => GitAvatarParams.fromJson({ email: "a".repeat(1001) }, "$.params"), { name: "ProtocolFieldException", field: "$.params.email" });
    assert.throws(() => GitAvatarParams.fromJson({}), { name: "JsonException", path: "$.email" });
    assert.throws(() => GitAvatarParams.fromJson({ email: "a@b.c", size: 64 }), { name: "ProtocolFieldException", field: "$.size" });
  });
});
