/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { SignatureState } from "../../src/enums/signature-state.ts";
import { GitCommitSignature } from "../../src/models/git-commit-signature.ts";

describe("GitCommitSignature", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";
  const json = { id, state: "Verified", signer: "A Person <a@example.com>", key: "SHA256:abc" };

  it("keeps its id, state, signer and key, reads back the same, and keeps an unsigned commit's signer and key null", () => {
    const signature = new GitCommitSignature(id, SignatureState.Verified, "A Person <a@example.com>", "SHA256:abc");
    const unsigned = new GitCommitSignature(id, SignatureState.None, null, null);

    assert.deepEqual(signature.toJson(), json);
    assert.deepEqual(GitCommitSignature.fromJson(JSON.parse(JSON.stringify(json))), signature);
    assert.deepEqual(GitCommitSignature.fromJson(unsigned.toJson()), unsigned);
    assert.deepEqual(Object.values(SignatureState), ["Verified", "Unverified", "None"]);
  });

  it("refuses a short id, an unknown state, an empty or multi-line signer or key, a signer or key on an unsigned commit and an unknown field, naming its path", () => {
    assert.throws(() => GitCommitSignature.fromJson({ ...json, id: "0123" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitCommitSignature.fromJson({ ...json, state: "Good" }), { name: "JsonException", path: "$.state" });
    assert.throws(() => GitCommitSignature.fromJson({ ...json, signer: "" }), { name: "ProtocolFieldException", field: "$.signer" });
    assert.throws(() => GitCommitSignature.fromJson({ ...json, key: "a\nb" }), { name: "ProtocolFieldException", field: "$.key" });
    assert.throws(() => GitCommitSignature.fromJson({ ...json, state: "None", key: null }), { name: "ProtocolFieldException", field: "$.signer" });
    assert.throws(() => GitCommitSignature.fromJson({ ...json, state: "None", signer: null }), { name: "ProtocolFieldException", field: "$.key" });
    assert.throws(() => GitCommitSignature.fromJson({ ...json, extra: 1 }), { name: "ProtocolFieldException" });
  });
});
