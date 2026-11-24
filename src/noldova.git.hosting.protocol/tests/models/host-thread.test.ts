/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostComment, HostingFieldException, HostPerson, HostThread, ThreadStatus } from "../../src/api/index.ts";

const octocat: HostPerson = new HostPerson("octocat@fabrikam.com", null, null);
const comment: HostComment = new HostComment(1, null, octocat, 1_800_000_000_000, "Should this respect local times?");
const reply: HostComment = new HostComment(2, 1, octocat, 1_800_000_060_000, "Yes, fixed.");

describe("HostThread", () => {
  it("returns its id, state, file, line and comments as JSON that reads back the same", () => {
    const onFile: HostThread = new HostThread(7, ThreadStatus.Resolved, "/src/notes/local times.ts", 42, [comment, reply]);
    const general: HostThread = new HostThread(8, ThreadStatus.Active, null, null, [comment]);
    const onWholeFile: HostThread = new HostThread(9, ThreadStatus.None, "/README.md", null, [comment]);

    assert.deepEqual(onFile.toJson(), { id: 7, state: "Resolved", path: "/src/notes/local times.ts", line: 42, comments: [comment.toJson(), reply.toJson()] });
    assert.deepEqual([onFile, general, onWholeFile].map(t => HostThread.fromJson(JSON.parse(JSON.stringify(t.toJson())))), [onFile, general, onWholeFile]);
  });

  it("keeps its own copy of the comments", () => {
    const comments: HostComment[] = [comment];
    const thread: HostThread = new HostThread(7, ThreadStatus.Active, null, null, comments);

    comments.push(reply);

    assert.deepEqual(thread.comments, [comment]);
  });

  it("refuses an id or line below one, a blank file, a line with no file and no comments, naming the parameter", () => {
    assert.throws(() => new HostThread(0, ThreadStatus.Active, null, null, [comment]), { name: "HostingArgumentException", parameterName: "id" });
    assert.throws(() => new HostThread(7, ThreadStatus.Active, " ", null, [comment]), { name: "HostingArgumentException", parameterName: "path" });
    assert.throws(() => new HostThread(7, ThreadStatus.Active, "/a.ts", 0, [comment]), { name: "HostingArgumentException", parameterName: "line" });
    assert.throws(() => new HostThread(7, ThreadStatus.Active, null, 4, [comment]),
      { name: "HostingArgumentException", parameterName: "line", message: "The argument line is invalid: expected a line only on a thread that names a file." });
    assert.throws(() => new HostThread(7, ThreadStatus.Active, null, null, []),
      { name: "HostingArgumentException", parameterName: "comments", message: "The argument comments is invalid: expected at least one comment." });
  });

  it("refuses JSON with a field it doesn't define, a state it doesn't know or a comment out of its range, naming the field by its path", () => {
    const json = new HostThread(7, ThreadStatus.Active, "/a.ts", 4, [comment]).toJson();

    assert.throws(() => HostThread.fromJson({ ...json, isDeleted: false }), HostingFieldException);
    assert.throws(() => HostThread.fromJson({ ...json, state: "Fixed" }, "$.0"), { name: "JsonException", path: "$.0.state" });
    assert.throws(() => HostThread.fromJson({ ...json, comments: [{ ...comment.toJson(), id: -1 }] }), { name: "HostingFieldException", field: "$.comments.0.id" });
    assert.throws(() => HostThread.fromJson({ ...json, line: "4" }), { name: "JsonException", path: "$.line" });
  });
});
