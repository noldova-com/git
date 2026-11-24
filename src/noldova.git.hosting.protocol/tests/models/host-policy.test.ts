/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostPolicy, PolicyState } from "../../src/api/index.ts";

const reviewers: HostPolicy = new HostPolicy("Minimum number of reviewers", PolicyState.Approved, true,
  "https://dev.azure.com/fabrikam/web/_settings/repositories");

describe("HostPolicy", () => {
  it("takes each policy state with or without a page, and returns itself as JSON that reads back the same", () => {
    assert.deepEqual(reviewers.toJson(),
      { name: "Minimum number of reviewers", state: "Approved", isBlocking: true, url: "https://dev.azure.com/fabrikam/web/_settings/repositories", buildNumber: null });
    for (const state of Object.values(PolicyState)) {
      const policy: HostPolicy = new HostPolicy("Build", state, false, null);
      assert.deepEqual(HostPolicy.fromJson(policy.toJson()), policy);
    }
  });

  it("carries the number of the build a build policy ran when the host gives one, none by default, and reads JSON without it as none", () => {
    const build: HostPolicy = new HostPolicy("Build: portal-web PR validation", PolicyState.Approved, true, null, "20261121.4");
    const { buildNumber: _found, ...older } = reviewers.toJson();

    assert.deepEqual([build.buildNumber, build.toJson()["buildNumber"], HostPolicy.fromJson(build.toJson()), reviewers.buildNumber, HostPolicy.fromJson(older).buildNumber],
      ["20261121.4", "20261121.4", build, null, null]);
  });

  it("refuses a blank build number, naming it as the parameter, or by its path in JSON", () => {
    assert.throws(() => new HostPolicy("Build", PolicyState.Running, true, null, " "), { name: "HostingArgumentException", parameterName: "buildNumber" });
    assert.throws(() => HostPolicy.fromJson({ ...reviewers.toJson(), buildNumber: "" }, "$.policies.0"), { name: "HostingFieldException", field: "$.policies.0.buildNumber" });
  });

  it("refuses a blank name and an address that isn't https, naming the parameter", () => {
    assert.throws(() => new HostPolicy(" ", PolicyState.Queued, true, null), { name: "HostingArgumentException", parameterName: "name" });
    assert.throws(() => new HostPolicy("Build", PolicyState.Queued, true, "http://dev.azure.com/fabrikam"), { name: "HostingArgumentException", parameterName: "url" });
  });

  it("refuses JSON with a field it doesn't define, out of its range or a state it doesn't know, naming the field by its path", () => {
    assert.throws(() => HostPolicy.fromJson({ ...reviewers.toJson(), type: "x" }), { name: "HostingFieldException", field: "$.type" });
    assert.throws(() => HostPolicy.fromJson({ ...reviewers.toJson(), url: "page" }, "$.policies.1"), { name: "HostingFieldException", field: "$.policies.1.url" });
    assert.throws(() => HostPolicy.fromJson({ ...reviewers.toJson(), state: "Broken" }), { name: "JsonException", path: "$.state" });
  });
});
