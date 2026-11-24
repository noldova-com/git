/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostComment, HostPerson, HostPullRequestThreads, HostThread, ThreadStatus } from "../../src/api/index.ts";

const thread: HostThread = new HostThread(3, ThreadStatus.None, "src/app.ts", 4, [new HostComment(1, null, new HostPerson("octocat", null, null), 1_800_000_000_000,
  "Looks good.")]);

describe("HostPullRequestThreads", () => {
  it("returns its threads and whether there are older comments as JSON that reads back the same, and keeps its own copy of the threads", () => {
    const threads: HostThread[] = [thread];
    const list = new HostPullRequestThreads(threads, true);
    threads.pop();

    assert.deepEqual(list.toJson(), { threads: [thread.toJson()], hasMore: true });
    assert.deepEqual(HostPullRequestThreads.fromJson(JSON.parse(JSON.stringify(list.toJson()))), list);
    assert.deepEqual(HostPullRequestThreads.fromJson({ threads: [], hasMore: false }), new HostPullRequestThreads([], false));
  });

  it("refuses JSON with a field it doesn't define or a thread it can't read, naming the field by its path", () => {
    assert.throws(() => HostPullRequestThreads.fromJson({ threads: [], hasMore: false, total: 0 }), { name: "HostingFieldException", field: "$.total" });
    assert.throws(() => HostPullRequestThreads.fromJson({ threads: [{ ...thread.toJson(), id: 0 }], hasMore: false }),
      { name: "HostingFieldException", field: "$.threads.0.id" });
    assert.throws(() => HostPullRequestThreads.fromJson({ threads: [], hasMore: "no" }), { name: "JsonException", path: "$.hasMore" });
  });
});
