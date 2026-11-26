/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { FileState } from "../../src/enums/file-state.ts";
import { OperationKind } from "../../src/enums/operation-kind.ts";
import { RemoteTransport } from "../../src/enums/remote-transport.ts";
import { GitOperation } from "../../src/models/git-operation.ts";
import { GitRemote } from "../../src/models/git-remote.ts";
import { GitStatus } from "../../src/models/git-status.ts";
import { StatusEntry } from "../../src/models/status-entry.ts";
import { StatusUpstream } from "../../src/models/status-upstream.ts";

describe("GitStatus", () => {
  const head = "0123456789abcdef0123456789abcdef01234567";
  const json = { branch: "main", head, upstream: null, entries: [], truncated: false, fingerprint: "f", operation: null, remote: null, uncheckedLfsFiles: 0, fetchedAt: null };

  it("keeps its branch, head, upstream, entries, whether it was cut, its fingerprint, operation, remote, unchecked LFS files and fetch time, and reads back the same", () => {
    const entry = new StatusEntry("a.txt", undefined, null, undefined, FileState.Untracked, FileState.Untracked, null, null, null, null);
    const operation = new GitOperation(OperationKind.Rebase, "feature/view", null);
    const remote = new GitRemote("origin", "host.example", "team/repo", RemoteTransport.Https);
    const status = new GitStatus("main", head, new StatusUpstream("origin/main", 0, 2, false), [entry], true, "f1", operation, remote, 3, "2026-11-22T18:05:00+02:00");

    assert.deepEqual(status.toJson(), {
      branch: "main",
      head,
      upstream: { name: "origin/main", ahead: 0, behind: 2, gone: false, id: null },
      entries: [entry.toJson()],
      truncated: true,
      fingerprint: "f1",
      operation: { kind: "Rebase", from: "feature/view", message: null },
      remote: { name: "origin", host: "host.example", path: "team/repo", transport: "Https" },
      uncheckedLfsFiles: 3,
      fetchedAt: "2026-11-22T18:05:00+02:00"
    });
    assert.deepEqual(GitStatus.fromJson(JSON.parse(JSON.stringify(status.toJson()))), status);
  });

  it("a detached HEAD has no branch, a repository with no commits has no head, and a status may have no operation or remote", () => {
    const status = new GitStatus(null, null, null, [], false, "f0", null, null);

    assert.deepEqual(status.toJson(), { branch: null, head: null, upstream: null, entries: [], truncated: false, fingerprint: "f0", operation: null, remote: null, uncheckedLfsFiles: 0, fetchedAt: null });
    assert.deepEqual(GitStatus.fromJson(status.toJson()), status);
  });

  it("refuses an empty branch, an abbreviated head, an empty or missing fingerprint, an invalid entry and a missing or invalid unchecked count, naming its path", () => {
    assert.throws(() => new GitStatus("", head, null, [], false, "f", null, null), { name: "ProtocolFieldException", field: "branch" });
    assert.throws(() => new GitStatus("main", "0123456", null, [], false, "f", null, null), { name: "ProtocolFieldException", field: "head" });
    assert.throws(() => new GitStatus("main", head, null, [], false, "", null, null), { name: "ProtocolFieldException", field: "fingerprint" });
    assert.throws(() => GitStatus.fromJson({ ...json, fingerprint: "" }), { name: "ProtocolFieldException", field: "$.fingerprint" });
    assert.throws(() => GitStatus.fromJson({ branch: "main", head, upstream: null, entries: [], truncated: false, operation: null, remote: null, uncheckedLfsFiles: 0, fetchedAt: null }), { name: "JsonException", path: "$.fingerprint" });
    assert.throws(() => new GitStatus("main", head, null, [], false, "f", null, null, -1), { name: "ProtocolFieldException", field: "uncheckedLfsFiles" });
    assert.throws(() => GitStatus.fromJson({ ...json, uncheckedLfsFiles: -2 }), { name: "ProtocolFieldException", field: "$.uncheckedLfsFiles" });
    assert.throws(() => GitStatus.fromJson({ ...json, uncheckedLfsFiles: 1.5 }), { name: "JsonException", path: "$.uncheckedLfsFiles" });
    assert.throws(() => GitStatus.fromJson({ branch: "main", head, upstream: null, entries: [], truncated: false, fingerprint: "f", operation: null, remote: null, fetchedAt: null }),
      { name: "JsonException", path: "$.uncheckedLfsFiles" });
    assert.throws(() => GitStatus.fromJson({ ...json, entries: [{}] }), { name: "JsonException", path: "$.entries.0.path" });
    assert.throws(() => GitStatus.fromJson({ ...json, upstream: { name: "", ahead: 0, behind: 0, gone: false, id: null } }), { name: "ProtocolFieldException", field: "$.upstream.name" });
  });

  it("refuses a fetch time that isn't an ISO 8601 date and time with its offset, or a missing one, naming its path", () => {
    assert.throws(() => new GitStatus("main", head, null, [], false, "f", null, null, 0, "2026-11-22 18:05"), { name: "ProtocolFieldException", field: "fetchedAt" });
    assert.throws(() => GitStatus.fromJson({ ...json, fetchedAt: "2026-11-22T18:05:00.123Z" }), { name: "ProtocolFieldException", field: "$.fetchedAt" });
    assert.throws(() => GitStatus.fromJson({ ...json, fetchedAt: "2026-13-45T18:05:00Z" }), { name: "ProtocolFieldException", field: "$.fetchedAt" });
    const { fetchedAt: _fetchedAt, ...missing } = json;
    assert.throws(() => GitStatus.fromJson(missing), { name: "JsonException", path: "$.fetchedAt" });
  });

  it("refuses a missing or invalid operation or remote, naming its path", () => {
    assert.throws(() => GitStatus.fromJson({ branch: "main", head, upstream: null, entries: [], truncated: false, fingerprint: "f", remote: null, uncheckedLfsFiles: 0, fetchedAt: null }), { name: "JsonException", path: "$.operation" });
    assert.throws(() => GitStatus.fromJson({ branch: "main", head, upstream: null, entries: [], truncated: false, fingerprint: "f", operation: null, uncheckedLfsFiles: 0, fetchedAt: null }), { name: "JsonException", path: "$.remote" });
    assert.throws(() => GitStatus.fromJson({ ...json, operation: { kind: "Bisect", from: null, message: null } }), { name: "JsonException", path: "$.operation.kind" });
    assert.throws(() => GitStatus.fromJson({ ...json, remote: { name: "", host: null, path: null, transport: "Ssh" } }), { name: "ProtocolFieldException", field: "$.remote.name" });
  });
});
