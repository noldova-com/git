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
  test("answers the status with the entries, fingerprint, operation and remote it is given, keeping what git's status line said", () => {
    const head = "a".repeat(40);
    const parsed = new ParsedStatus("main", head, new StatusUpstream("origin/main", 1, 2, false), [], true);
    const entries = [new StatusEntry("a.txt", undefined, null, undefined, FileState.Unmodified, FileState.Modified, null, null, null, null)];
    const operation = new GitOperation(OperationKind.Merge, "feature", null);
    const remote = new GitRemote("origin", "host", "team/repo", RemoteTransport.Https);

    const status = parsed.toStatus(entries, "fingerprint", operation, remote);

    assert.deepEqual([status.branch, status.head, status.upstream, status.entries, status.truncated, status.fingerprint, status.operation, status.remote],
      ["main", head, parsed.upstream, entries, true, "fingerprint", operation, remote]);
  });
});
