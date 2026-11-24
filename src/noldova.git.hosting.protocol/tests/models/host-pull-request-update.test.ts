/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostPerson, HostPullRequestUpdate } from "../../src/api/index.ts";

const SOURCE: string = "9fceb02d0ae598e95dc970b74767f19372d61af8";
const COMMON: string = "0123456789abcdef0123456789abcdef01234567";
const AT: number = Date.UTC(2026, 10, 23, 10);
const kim: HostPerson = new HostPerson("kim@fabrikam.com", null, null);

describe("HostPullRequestUpdate", () => {
  it("returns its number, author, time and commits as JSON that reads back the same, without an author or common commit too", () => {
    const bare = new HostPullRequestUpdate(2, null, AT, SOURCE, null);

    assert.deepEqual(new HostPullRequestUpdate(3, kim, AT, SOURCE, COMMON).toJson(), { number: 3, author: { login: "kim@fabrikam.com", avatar: null, url: null },
      createdAt: AT, sourceCommit: SOURCE, commonCommit: COMMON });
    assert.deepEqual(HostPullRequestUpdate.fromJson(JSON.parse(JSON.stringify(bare.toJson()))), bare);
    assert.deepEqual(HostPullRequestUpdate.fromJson(new HostPullRequestUpdate(3, kim, AT, SOURCE, COMMON).toJson()).author, kim);
  });

  it("refuses a number or time that isn't positive, and commits that aren't ids", () => {
    assert.throws(() => new HostPullRequestUpdate(0, null, AT, SOURCE, null), { name: "HostingArgumentException", parameterName: "number" });
    assert.throws(() => new HostPullRequestUpdate(1, null, 0, SOURCE, null), { name: "HostingArgumentException", parameterName: "createdAt" });
    assert.throws(() => new HostPullRequestUpdate(1, null, AT, "x", null), { name: "HostingArgumentException", parameterName: "sourceCommit" });
    assert.throws(() => new HostPullRequestUpdate(1, null, AT, SOURCE, "x"), { name: "HostingArgumentException", parameterName: "commonCommit" });
  });

  it("refuses JSON with a field it doesn't define or of the wrong type, naming the field by its path", () => {
    const json = new HostPullRequestUpdate(1, null, AT, SOURCE, null).toJson();

    assert.throws(() => HostPullRequestUpdate.fromJson({ ...json, targetCommit: SOURCE }), HostingFieldException);
    assert.throws(() => HostPullRequestUpdate.fromJson({ ...json, sourceCommit: "x" }, "$.updates[0]"), { name: "HostingFieldException", field: "$.updates[0].sourceCommit" });
    assert.throws(() => HostPullRequestUpdate.fromJson({ ...json, createdAt: "now" }), { name: "JsonException", path: "$.createdAt" });
  });
});
