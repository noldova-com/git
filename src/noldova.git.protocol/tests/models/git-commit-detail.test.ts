/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { GitCommitDetail } from "../../src/models/git-commit-detail.ts";
import { GitCommitDetailParams } from "../../src/models/git-commit-detail-params.ts";

describe("GitCommitDetail", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";
  const json = { id, body: "Why.\n\nMore.", committer: "A Person", committerEmail: "a@example.com", committedAt: "2026-11-20T14:02:00+01:00", truncated: false };

  it("keeps its id, body, committer, email, time and whether the body was cut, and reads back the same", () => {
    const detail = new GitCommitDetail(id, "Why.\n\nMore.", "A Person", "a@example.com", "2026-11-20T14:02:00+01:00", false);

    assert.deepEqual(detail.toJson(), json);
    assert.deepEqual(GitCommitDetail.fromJson(JSON.parse(JSON.stringify(json))), detail);
  });

  it("refuses a short id, a body with a NUL, a committer or email of more than one line, an empty time and an unknown field, naming its path", () => {
    assert.throws(() => GitCommitDetail.fromJson({ ...json, id: "0123" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitCommitDetail.fromJson({ ...json, body: "a\0b" }), { name: "ProtocolFieldException", field: "$.body" });
    assert.throws(() => GitCommitDetail.fromJson({ ...json, committer: "a\nb" }), { name: "ProtocolFieldException", field: "$.committer" });
    assert.throws(() => GitCommitDetail.fromJson({ ...json, committerEmail: "a\nb" }), { name: "ProtocolFieldException", field: "$.committerEmail" });
    assert.throws(() => GitCommitDetail.fromJson({ ...json, committedAt: "" }), { name: "ProtocolFieldException", field: "$.committedAt" });
    assert.throws(() => GitCommitDetail.fromJson({ ...json, extra: 1 }), { name: "ProtocolFieldException" });
  });
});

describe("GitCommitDetailParams", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its folder and id, reads back the same, and refuses a relative folder, a short id and an unknown field", () => {
    const params = new GitCommitDetailParams("/home/a/repo", id);

    assert.deepEqual(GitCommitDetailParams.fromJson(params.toJson()), params);
    assert.throws(() => GitCommitDetailParams.fromJson({ folder: "repo", id }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitCommitDetailParams.fromJson({ folder: "/home/a/repo", id: "01" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitCommitDetailParams.fromJson({ folder: "/home/a/repo", id, more: 1 }), { name: "ProtocolFieldException" });
  });
});
