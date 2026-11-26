/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitGraphParams } from "../../src/models/git-graph-params.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitGraphParams", () => {
  it("keeps its folder, page size and offset, and reads back the same, at the page's bounds too", () => {
    const params = new GitGraphParams("/home/a/repo", 100, 200);
    const bounds = new GitGraphParams("/r", 5000, 0);

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", limit: 100, skip: 200 });
    assert.deepEqual(GitGraphParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
    assert.deepEqual(GitGraphParams.fromJson(JSON.parse(JSON.stringify(bounds.toJson()))), bounds);
    assert.equal(new GitGraphParams("/r", 1, 0).limit, 1);
  });

  it("refuses a relative folder, a page out of range or fractional, and a negative or fractional offset, naming its path", () => {
    const limit = "a whole number from 1 to 5000";
    const skip = "a whole number from 0";

    assert.throws(() => GitGraphParams.fromJson({ folder: "repo", limit: 1, skip: 0 }), expected("$.folder", "an absolute path of at most 4096 characters"));
    assert.throws(() => GitGraphParams.fromJson({ folder: "/r", limit: 0, skip: 0 }), expected("$.limit", limit));
    assert.throws(() => GitGraphParams.fromJson({ folder: "/r", limit: 5001, skip: 0 }), expected("$.limit", limit));
    assert.throws(() => new GitGraphParams("/r", 1.5, 0), expected("limit", limit));
    assert.throws(() => GitGraphParams.fromJson({ folder: "/r", limit: 1, skip: -1 }), expected("$.skip", skip));
    assert.throws(() => new GitGraphParams("/r", 1, 0.5), expected("skip", skip));
  });

  it("refuses a limit that isn't a number and a field it doesn't define", () => {
    assert.throws(() => GitGraphParams.fromJson({ folder: "/r", limit: "1", skip: 0 }), { name: "JsonException", path: "$.limit" });
    assert.throws(() => GitGraphParams.fromJson({ folder: "/r", limit: 1, skip: 0, more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
