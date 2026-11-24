/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostComment, HostingFieldException, HostPerson } from "../../src/api/index.ts";

const monalisa: HostPerson = new HostPerson("monalisa@fabrikam.com", null, null);
const PUBLISHED: number = 1_800_000_000_000;

describe("HostComment", () => {
  it("returns its id, parent, author, time and text as JSON that reads back the same", () => {
    const reply: HostComment = new HostComment(2, 1, monalisa, PUBLISHED, "Done in the **next** commit.");
    const first: HostComment = new HostComment(1, null, monalisa, PUBLISHED, "Should this respect local times?");

    assert.deepEqual(reply.toJson(), { id: 2, parent: 1, author: monalisa.toJson(), publishedAt: PUBLISHED, body: "Done in the **next** commit." });
    assert.deepEqual(HostComment.fromJson(JSON.parse(JSON.stringify(reply.toJson()))), reply);
    assert.deepEqual(HostComment.fromJson(first.toJson()), first);
  });

  it("refuses an id, parent or time below one, a parent that is the comment itself and a blank text, naming the parameter", () => {
    assert.throws(() => new HostComment(0, null, monalisa, PUBLISHED, "Fix"), { name: "HostingArgumentException", parameterName: "id" });
    assert.throws(() => new HostComment(2, 0, monalisa, PUBLISHED, "Fix"), { name: "HostingArgumentException", parameterName: "parent" });
    assert.throws(() => new HostComment(2, 2, monalisa, PUBLISHED, "Fix"),
      { name: "HostingArgumentException", parameterName: "parent", message: "The argument parent is invalid: expected a parent other than the comment itself." });
    assert.throws(() => new HostComment(2, 1, monalisa, 0, "Fix"), { name: "HostingArgumentException", parameterName: "publishedAt" });
    assert.throws(() => new HostComment(2, 1, monalisa, PUBLISHED, " "), { name: "HostingArgumentException", parameterName: "body" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new HostComment(2, 1, monalisa, PUBLISHED, "Fix").toJson();

    assert.throws(() => HostComment.fromJson({ ...json, isDeleted: false }), HostingFieldException);
    assert.throws(() => HostComment.fromJson({ ...json, parent: 2 }, "$.comments.1"), { name: "HostingFieldException", field: "$.comments.1.parent" });
    assert.throws(() => HostComment.fromJson({ ...json, author: { ...monalisa.toJson(), login: "" } }), { name: "HostingFieldException", field: "$.author.login" });
    assert.throws(() => HostComment.fromJson({ ...json, body: null }), { name: "JsonException", path: "$.body" });
  });
});
