/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { FailureCode } from "../../src/enums/failure-code.ts";
import { GitCode } from "../../src/enums/git-code.ts";
import { GitFailure } from "../../src/models/git-failure.ts";

describe("GitFailure", () => {
  it("keeps its code, git's code and its message, and reads back the same", () => {
    const failure = new GitFailure(FailureCode.Git, GitCode.PushRejected, "The remote has commits the branch doesn't.", null);

    assert.deepEqual(failure.toJson(), { code: "Git", gitCode: "PushRejected", message: "The remote has commits the branch doesn't.", gitVersion: null });
    assert.deepEqual(GitFailure.fromJson(JSON.parse(JSON.stringify(failure.toJson()))), failure);
  });

  it("may have no git code", () => {
    const failure = new GitFailure(FailureCode.Stale, null, "The status changed.", null);

    assert.deepEqual(failure.toJson(), { code: "Stale", gitCode: null, message: "The status changed.", gitVersion: null });
    assert.deepEqual(GitFailure.fromJson(failure.toJson()), failure);
  });

  it("names the version of a git that is too old, or none when git didn't say", () => {
    for (const version of ["2.34.1", "2.39.0.windows.1", null]) {
      const failure = new GitFailure(FailureCode.Unavailable, GitCode.GitTooOld, "Git is too old.", version);

      assert.equal(GitFailure.fromJson(failure.toJson()).gitVersion, version);
    }
  });

  it("refuses an empty message, an unknown code, a missing field and an unknown field, naming its path", () => {
    assert.throws(() => new GitFailure(FailureCode.Refused, null, "", null), { name: "ProtocolFieldException", field: "message", message: "The field message is invalid: expected a text that isn't empty." });
    assert.throws(() => GitFailure.fromJson({ code: "Git", gitCode: null, message: "", gitVersion: null }, "$.details"), { name: "ProtocolFieldException", field: "$.details.message" });
    assert.throws(() => GitFailure.fromJson({ code: "Broken", gitCode: null, message: "m", gitVersion: null }), { name: "JsonException", path: "$.code" });
    assert.throws(() => GitFailure.fromJson({ code: "Git", gitCode: "Unknown", message: "m", gitVersion: null }), { name: "JsonException", path: "$.gitCode" });
    assert.throws(() => GitFailure.fromJson({ code: "Git", message: "m", gitVersion: null }), { name: "JsonException", path: "$.gitCode" });
    assert.throws(() => GitFailure.fromJson({ code: "Git", gitCode: null, message: "m" }), { name: "JsonException", path: "$.gitVersion" });
    assert.throws(() => GitFailure.fromJson({ code: "Git", gitCode: null, message: "m", gitVersion: null, stack: "" }), { name: "ProtocolFieldException", field: "$.stack" });
  });

  it("refuses a version with any other git code, or one that isn't a version, naming its path", () => {
    assert.throws(() => new GitFailure(FailureCode.Unavailable, GitCode.GitMissing, "m", "2.34.1"), { name: "ProtocolFieldException", field: "gitVersion" });
    assert.throws(() => new GitFailure(FailureCode.Git, null, "m", "2.34.1"), { name: "ProtocolFieldException", field: "gitVersion" });
    for (const version of ["", "2", "v2.34.1", "2.34.1 (Apple Git-145)", "2.34.1\n"])
      assert.throws(() => new GitFailure(FailureCode.Unavailable, GitCode.GitTooOld, "m", version), { name: "ProtocolFieldException", field: "gitVersion" });
    assert.throws(() => GitFailure.fromJson({ code: "Unavailable", gitCode: "GitTooOld", message: "m", gitVersion: "x" }, "$.details"), { name: "ProtocolFieldException", field: "$.details.gitVersion" });
  });
});
