/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostReference, HostReviewRequest } from "../../src/api/index.ts";

const reference: HostReference = new HostReference("git-github", "octocat", "hello-world", 533);
const url: string = "https://github.com/octocat/hello-world/pull/533";
const opened: number = Date.parse("2026-11-20T09:00:00Z");

describe("HostReviewRequest", () => {
  it("returns its parts as JSON that reads back the same", () => {
    const request: HostReviewRequest = new HostReviewRequest(reference, "Sign in with a passkey", url, true, opened);

    assert.deepEqual(request.toJson(), { reference: reference.toJson(), title: "Sign in with a passkey", url, isDraft: true, createdAt: opened });
    assert.deepEqual(HostReviewRequest.fromJson(JSON.parse(JSON.stringify(request.toJson()))), request);
  });

  it("refuses a blank title, a page that isn't https and an opening time that isn't a positive whole number, naming the parameter", () => {
    assert.throws(() => new HostReviewRequest(reference, " ", url, false, opened), { name: "HostingArgumentException", parameterName: "title" });
    assert.throws(() => new HostReviewRequest(reference, "Fix", "http://github.com/x", false, opened), { name: "HostingArgumentException", parameterName: "url" });
    assert.throws(() => new HostReviewRequest(reference, "Fix", url, false, 0), { name: "HostingArgumentException", parameterName: "createdAt" });
    assert.throws(() => new HostReviewRequest(reference, "Fix", url, false, 1.5), { name: "HostingArgumentException", parameterName: "createdAt" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new HostReviewRequest(reference, "Fix", url, false, opened).toJson();

    assert.throws(() => HostReviewRequest.fromJson({ ...json, headBranch: "fix" }), HostingFieldException);
    assert.throws(() => HostReviewRequest.fromJson({ ...json, title: "" }, "$.rows.0"), { name: "HostingFieldException", field: "$.rows.0.title" });
    assert.throws(() => HostReviewRequest.fromJson({ ...json, reference: { ...reference.toJson(), number: 0 } }), { name: "HostingFieldException", field: "$.reference.number" });
    assert.throws(() => HostReviewRequest.fromJson({ ...json, isDraft: "no" }), { name: "JsonException", path: "$.isDraft" });
    assert.throws(() => HostReviewRequest.fromJson(Object.fromEntries(Object.entries(json).filter(([t]) => t !== "createdAt"))), { name: "JsonException", path: "$.createdAt" });
  });
});
