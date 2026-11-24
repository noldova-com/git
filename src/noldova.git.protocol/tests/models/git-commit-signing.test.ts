/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { SigningFormat } from "../../src/enums/signing-format.ts";
import { GitCommitSigning } from "../../src/models/git-commit-signing.ts";

describe("GitCommitSigning", () => {
  const json = { signs: true, format: "Ssh" };

  it("keeps whether a commit is signed and the format it signs with, reads back the same, and keeps an unknown format null", () => {
    const signing = new GitCommitSigning(true, SigningFormat.Ssh);
    const unknown = new GitCommitSigning(false, null);

    assert.deepEqual(signing.toJson(), json);
    assert.deepEqual(GitCommitSigning.fromJson(JSON.parse(JSON.stringify(json))), signing);
    assert.deepEqual(GitCommitSigning.fromJson(unknown.toJson()), unknown);
    assert.deepEqual([unknown.signs, unknown.format], [false, null]);
    assert.deepEqual(Object.values(SigningFormat), ["OpenPgp", "Ssh", "X509"]);
  });

  it("refuses a signs that isn't a boolean, an unknown format and an unknown field, naming its path", () => {
    assert.throws(() => GitCommitSigning.fromJson({ ...json, signs: "true" }), { name: "JsonException", path: "$.signs" });
    assert.throws(() => GitCommitSigning.fromJson({ ...json, format: "ssh" }), { name: "JsonException", path: "$.format" });
    assert.throws(() => new GitCommitSigning(true, "ssh" as SigningFormat), { name: "ProtocolFieldException", field: "format" });
    assert.throws(() => GitCommitSigning.fromJson({ ...json, extra: 1 }), { name: "ProtocolFieldException" });
  });
});
