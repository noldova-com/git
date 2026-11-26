/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostPullRequestHead, HostReference } from "../../src/api/index.ts";

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "site", 214);
const url: string = "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/214";

describe("HostPullRequestHead", () => {
  it("returns its reference, title, page and branches as JSON that reads back the same, with no base when the host didn't say", () => {
    const head: HostPullRequestHead = new HostPullRequestHead(reference, "Add the sign-in page", url, "feature/sign-in", "main");

    assert.deepEqual(head.toJson(), { reference: reference.toJson(), title: "Add the sign-in page", url, headBranch: "feature/sign-in", baseBranch: "main" });
    assert.deepEqual(HostPullRequestHead.fromJson(JSON.parse(JSON.stringify(head.toJson()))), head);
    assert.equal(new HostPullRequestHead(reference, "Add the sign-in page", url, "feature/sign-in", null).baseBranch, null);
  });

  it("refuses a blank title, head or base and a page that isn't https, naming the parameter", () => {
    assert.throws(() => new HostPullRequestHead(reference, " ", url, "feature/sign-in", "main"), { name: "HostingArgumentException", parameterName: "title" });
    assert.throws(() => new HostPullRequestHead(reference, "Add the sign-in page", "http://dev.azure.com/fabrikam", "feature/sign-in", "main"),
      { name: "HostingArgumentException", parameterName: "url" });
    assert.throws(() => new HostPullRequestHead(reference, "Add the sign-in page", url, "", "main"), { name: "HostingArgumentException", parameterName: "headBranch" });
    assert.throws(() => new HostPullRequestHead(reference, "Add the sign-in page", url, "feature/sign-in", " "),
      { name: "HostingArgumentException", parameterName: "baseBranch" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new HostPullRequestHead(reference, "Add the sign-in page", url, "feature/sign-in", "main").toJson();

    assert.throws(() => HostPullRequestHead.fromJson({ ...json, approvals: 0 }), HostingFieldException);
    assert.throws(() => HostPullRequestHead.fromJson({ ...json, headBranch: "" }, "$.head"), { name: "HostingFieldException", field: "$.head.headBranch" });
    assert.throws(() => HostPullRequestHead.fromJson({ ...json, reference: { ...reference.toJson(), number: 0 } }), { name: "HostingFieldException", field: "$.reference.number" });
    assert.throws(() => HostPullRequestHead.fromJson({ ...json, baseBranch: 1 }), { name: "JsonException", path: "$.baseBranch" });
  });
});
