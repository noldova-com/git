/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostPerson, HostPullRequestUpdate, HostPullRequestUpdates } from "../../src/api/index.ts";

const SOURCE: string = "9fceb02d0ae598e95dc970b74767f19372d61af8";
const COMMON: string = "0123456789abcdef0123456789abcdef01234567";
const AT: number = Date.UTC(2026, 10, 23, 10);
const kim: HostPerson = new HostPerson("kim@fabrikam.test", null, null);

function updatesOf(count: number): HostPullRequestUpdate[] {
  return Array.from({ length: count }, (_, i) => new HostPullRequestUpdate(i + 1, kim, AT, SOURCE, COMMON));
}

describe("HostPullRequestUpdates", () => {
  it("returns its updates and whether there are more as JSON that reads back the same, more only after 100", () => {
    const full = new HostPullRequestUpdates(updatesOf(100), true);

    assert.deepEqual(new HostPullRequestUpdates([], false).toJson(), { updates: [], hasMore: false });
    assert.deepEqual(HostPullRequestUpdates.fromJson(JSON.parse(JSON.stringify(full.toJson()))), full);
    assert.deepEqual([full.updates.length, full.hasMore, HostPullRequestUpdates.maximumCount], [100, true, 100]);
  });

  it("refuses more than 100 updates, and more before 100", () => {
    assert.throws(() => new HostPullRequestUpdates(updatesOf(101), true), { name: "HostingArgumentException", parameterName: "updates",
      message: "The argument updates is invalid: expected at most 100 updates." });
    assert.throws(() => new HostPullRequestUpdates(updatesOf(99), true), { name: "HostingArgumentException", parameterName: "hasMore",
      message: "The argument hasMore is invalid: expected more only after 100 updates." });
  });

  it("refuses JSON with a field it doesn't define", () => {
    assert.throws(() => HostPullRequestUpdates.fromJson({ updates: [], hasMore: false, total: 0 }), HostingFieldException);
  });
});
