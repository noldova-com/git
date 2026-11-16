/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitCommit } from "../../src/models/git-commit.ts";
import { GitLog } from "../../src/models/git-log.ts";

describe("GitLog", () => {
  const commit = new GitCommit("a".repeat(40), [], "Sample Author", "2026-11-06T17:30:00Z", "First");

  it("keeps its commits and whether more were left out, and reads back the same", () => {
    const log = new GitLog([commit], true);

    assert.deepEqual(log.toJson(), { commits: [commit.toJson()], truncated: true });
    assert.deepEqual(GitLog.fromJson(JSON.parse(JSON.stringify(log.toJson()))), log);
    assert.deepEqual(new GitLog([], false).toJson(), { commits: [], truncated: false });
  });

  it("holds at most 500 commits", () => {
    assert.equal(new GitLog(Array.from({ length: 500 }, () => commit), true).commits.length, 500);
    assert.throws(() => new GitLog(Array.from({ length: 501 }, () => commit), true), { name: "ProtocolFieldException", field: "commits", message: "The field commits is invalid: expected at most 500 commits." });
  });

  it("refuses a commit the protocol refuses, a missing field and an unknown one, naming its path", () => {
    assert.throws(() => GitLog.fromJson({ commits: [{ ...commit.toJson(), id: "x" }], truncated: false }), { name: "ProtocolFieldException", field: "$.commits.0.id" });
    assert.throws(() => GitLog.fromJson({ commits: [] }), { name: "JsonException", path: "$.truncated" });
    assert.throws(() => GitLog.fromJson({ commits: [], truncated: false, more: 1 }), { name: "ProtocolFieldException", field: "$.more" });
  });
});
