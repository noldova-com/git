/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FileState, GitOperation, GitRemote, OperationKind, RemoteTransport, StatusEntry, StatusUpstream } from "@noldova/git.protocol";

import { ParsedStatus } from "../../src/models/parsed-status.ts";

describe("ParsedStatus", () => {
  test("answers the status with the entries, fingerprint, operation, remote and fetch time it is given, keeping what git's status line said, with the upstream's commit", () => {
    const head = "a".repeat(40);
    const parsed = new ParsedStatus("main", head, new StatusUpstream("origin/main", 1, 2, false), [], true);
    const entries = [new StatusEntry("a.txt", undefined, null, undefined, FileState.Unmodified, FileState.Modified, null, null, null, null)];
    const operation = new GitOperation(OperationKind.Merge, "feature", null);
    const remote = new GitRemote("origin", "host", "team/repo", RemoteTransport.Https);

    const status = parsed.toStatus(entries, "fingerprint", operation, remote, 2, "b".repeat(40), "2026-11-22T18:05:00Z");
    const detached = new ParsedStatus(null, head, null, [], false).toStatus([], "fingerprint", null, null, 0, null, null);

    assert.deepEqual([status.branch, status.head, status.upstream, status.entries, status.truncated, status.fingerprint, status.operation, status.remote,
      status.uncheckedLfsFiles, status.fetchedAt], ["main", head, new StatusUpstream("origin/main", 1, 2, false, "b".repeat(40)), entries, true, "fingerprint", operation, remote, 2, "2026-11-22T18:05:00Z"]);
    assert.equal(detached.upstream, null);
  });
});
