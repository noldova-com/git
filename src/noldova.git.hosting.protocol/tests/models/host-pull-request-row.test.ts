/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { CheckState, HostCheck, HostingFieldException, HostPullRequestRow, HostReference, PullRequestStatus } from "../../src/api/index.ts";

const reference: HostReference = new HostReference("git-github", "octocat", "hello-world", 214);
const url: string = "https://github.com/octocat/hello-world/pull/214";

function rowOf(passed: number, failing: number, pending: number): HostPullRequestRow {
  return new HostPullRequestRow(reference, "Add the sign-in page", url, false, 0, passed, failing, pending, "feature/sign-in");
}

describe("HostPullRequestRow", () => {
  it("returns its parts as JSON that reads back the same, with the base branch or null when the host didn't say", () => {
    const row: HostPullRequestRow = new HostPullRequestRow(reference, "Add the sign-in page", url, true, 2, 3, 1, 0, "feature/sign-in", "main");
    const unsaid: HostPullRequestRow = rowOf(0, 0, 0);

    assert.deepEqual(row.toJson(), { reference: reference.toJson(), title: "Add the sign-in page", url, isDraft: true, approvals: 2, passed: 3, failing: 1, pending: 0,
      headBranch: "feature/sign-in", baseBranch: "main" });
    assert.deepEqual(HostPullRequestRow.fromJson(JSON.parse(JSON.stringify(row.toJson()))), row);
    assert.deepEqual([unsaid.baseBranch, unsaid.toJson()["baseBranch"], HostPullRequestRow.fromJson(unsaid.toJson())], [null, null, unsaid]);
  });

  it("stands as Failed when a check failed, else Pending while one runs, else Succeeded when one passed, else None", () => {
    assert.deepEqual([rowOf(3, 1, 1).status, rowOf(3, 0, 1).status, rowOf(3, 0, 0).status, rowOf(0, 0, 0).status],
      [PullRequestStatus.Failed, PullRequestStatus.Pending, PullRequestStatus.Succeeded, PullRequestStatus.None]);
  });

  it("makes a row from a pull request's parts, counting passed, failed and queued or running checks and leaving neutral ones out", () => {
    const checks: readonly HostCheck[] = [CheckState.Succeeded, CheckState.Succeeded, CheckState.Failed, CheckState.Queued, CheckState.Running, CheckState.Neutral]
      .map((t, i) => new HostCheck(`check ${i}`, t, null));

    assert.deepEqual([HostPullRequestRow.of(reference, "Add the sign-in page", url, true, 2, checks, "feature/sign-in", "main"), HostPullRequestRow.of(reference, "Fix", url, false, 0, [], "fix")],
      [new HostPullRequestRow(reference, "Add the sign-in page", url, true, 2, 2, 1, 2, "feature/sign-in", "main"), new HostPullRequestRow(reference, "Fix", url, false, 0, 0, 0, 0, "fix")]);
    assert.throws(() => HostPullRequestRow.of(reference, " ", url, false, 0, [], "fix"), { name: "HostingArgumentException", parameterName: "title" });
  });

  it("refuses a blank title or head branch, a page that isn't https and a count below zero or not whole, naming the parameter", () => {
    assert.throws(() => new HostPullRequestRow(reference, " ", url, false, 0, 0, 0, 0, "fix"), { name: "HostingArgumentException", parameterName: "title" });
    assert.throws(() => new HostPullRequestRow(reference, "Fix", "http://github.com/x", false, 0, 0, 0, 0, "fix"), { name: "HostingArgumentException", parameterName: "url" });
    assert.throws(() => new HostPullRequestRow(reference, "Fix", url, false, -1, 0, 0, 0, "fix"), { name: "HostingArgumentException", parameterName: "approvals" });
    assert.throws(() => new HostPullRequestRow(reference, "Fix", url, false, 0, 0.5, 0, 0, "fix"), { name: "HostingArgumentException", parameterName: "passed" });
    assert.throws(() => new HostPullRequestRow(reference, "Fix", url, false, 0, 0, -2, 0, "fix"), { name: "HostingArgumentException", parameterName: "failing" });
    assert.throws(() => new HostPullRequestRow(reference, "Fix", url, false, 0, 0, 0, -1, "fix"), { name: "HostingArgumentException", parameterName: "pending" });
    assert.throws(() => new HostPullRequestRow(reference, "Fix", url, false, 0, 0, 0, 0, " "), { name: "HostingArgumentException", parameterName: "headBranch" });
    assert.throws(() => new HostPullRequestRow(reference, "Fix", url, false, 0, 0, 0, 0, "fix", " "), { name: "HostingArgumentException", parameterName: "baseBranch" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = rowOf(0, 0, 0).toJson();

    assert.throws(() => HostPullRequestRow.fromJson({ ...json, author: null }), HostingFieldException);
    assert.throws(() => HostPullRequestRow.fromJson({ ...json, pending: -1 }, "$.rows.0"), { name: "HostingFieldException", field: "$.rows.0.pending" });
    assert.throws(() => HostPullRequestRow.fromJson({ ...json, reference: { ...reference.toJson(), number: 0 } }), { name: "HostingFieldException", field: "$.reference.number" });
    assert.throws(() => HostPullRequestRow.fromJson({ ...json, isDraft: "no" }), { name: "JsonException", path: "$.isDraft" });
    assert.throws(() => HostPullRequestRow.fromJson({ ...json, headBranch: "" }, "$.rows.0"), { name: "HostingFieldException", field: "$.rows.0.headBranch" });
    assert.throws(() => HostPullRequestRow.fromJson(Object.fromEntries(Object.entries(json).filter(([t]) => t !== "headBranch"))), { name: "JsonException", path: "$.headBranch" });
    assert.throws(() => HostPullRequestRow.fromJson({ ...json, baseBranch: "" }, "$.rows.0"), { name: "HostingFieldException", field: "$.rows.0.baseBranch" });
    assert.throws(() => HostPullRequestRow.fromJson({ ...json, baseBranch: 1 }), { name: "JsonException", path: "$.baseBranch" });
  });
});
