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

describe("GitCommit", () => {
  const id = "a".repeat(40);
  const parent = "b".repeat(40);

  it("keeps its id, parents, author, time and subject, and reads back the same", () => {
    const commit = new GitCommit(id, [parent, "c".repeat(64)], "Sample Author", "2026-11-06T09:30:00-08:00", "Read the log");

    assert.deepEqual(commit.toJson(), { id, parents: [parent, "c".repeat(64)], author: "Sample Author", authoredAt: "2026-11-06T09:30:00-08:00", subject: "Read the log" });
    assert.deepEqual(GitCommit.fromJson(JSON.parse(JSON.stringify(commit.toJson()))), commit);
    assert.deepEqual(new GitCommit(id, [], "", "2026-11-06T17:30:00Z", "").toJson(), { id, parents: [], author: "", authoredAt: "2026-11-06T17:30:00Z", subject: "" });
  });

  it("refuses an id or parent that isn't an object id, naming its path", () => {
    assert.throws(() => new GitCommit("abc", [], "A", "2026-11-06T17:30:00Z", "S"), { name: "ProtocolFieldException", field: "id" });
    assert.throws(() => new GitCommit(id, [parent, "HEAD"], "A", "2026-11-06T17:30:00Z", "S"), { name: "ProtocolFieldException", field: "parents.1" });
    assert.throws(() => GitCommit.fromJson({ id, parents: ["x"], author: "A", authoredAt: "2026-11-06T17:30:00Z", subject: "S" }, "$.commits.0"), { name: "ProtocolFieldException", field: "$.commits.0.parents.0" });
  });

  it("refuses an author or subject that isn't one plain line", () => {
    const newline = String.fromCharCode(10);
    assert.throws(() => new GitCommit(id, [], "A" + newline + "B", "2026-11-06T17:30:00Z", "S"), { name: "ProtocolFieldException", field: "author" });
    assert.throws(() => new GitCommit(id, [], "A", "2026-11-06T17:30:00Z", "S".repeat(1001)), { name: "ProtocolFieldException", field: "subject" });
    assert.throws(() => new GitCommit(id, [], "A", "2026-11-06T17:30:00Z", String.fromCharCode(0x1b) + "[2J"), { name: "ProtocolFieldException", field: "subject" });
  });

  it("refuses a time without its offset or one that isn't a date", () => {
    const expected = { name: "ProtocolFieldException", field: "authoredAt", message: "The field authoredAt is invalid: expected an ISO 8601 date and time with its offset, such as 2026-11-06T09:30:00-08:00." };
    for (const authoredAt of ["2026-11-06T09:30:00", "1762450200", "2026-13-40T09:30:00Z"])
      assert.throws(() => new GitCommit(id, [], "A", authoredAt, "S"), expected, authoredAt);
  });

  it("refuses a missing field and an unknown one", () => {
    assert.throws(() => GitCommit.fromJson({ id, parents: [], author: "A", authoredAt: "2026-11-06T17:30:00Z" }), { name: "JsonException", path: "$.subject" });
    assert.throws(() => GitCommit.fromJson({ id, parents: [], author: "A", authoredAt: "2026-11-06T17:30:00Z", subject: "S", email: "a@b" }), { name: "ProtocolFieldException", field: "$.email" });
  });
});
