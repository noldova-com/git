/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitMessageReferenceKind } from "../../src/enums/git-message-reference-kind.ts";
import { GitMessageReferencesParams } from "../../src/models/git-message-references-params.ts";

const expected = (field: string, expectation: string): { name: string; field: string; message: string } =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitMessageReferencesParams", () => {
  it("keeps its folder, kind and limit, and reads back the same, at the limit's bounds too", () => {
    const params = new GitMessageReferencesParams("/home/a/repo", GitMessageReferenceKind.AzureBoards, 1000);
    const most = new GitMessageReferencesParams("/r", GitMessageReferenceKind.AzureBoards, 5000);

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", kind: "AzureBoards", limit: 1000 });
    assert.deepEqual(GitMessageReferencesParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
    assert.deepEqual(GitMessageReferencesParams.fromJson(JSON.parse(JSON.stringify(most.toJson()))), most);
    assert.equal(new GitMessageReferencesParams("/r", GitMessageReferenceKind.AzureBoards, 1).limit, 1);
  });

  it("refuses a relative folder and a limit out of range or fractional, naming its path", () => {
    const limit = "a whole number from 1 to 5000";

    assert.throws(() => GitMessageReferencesParams.fromJson({ folder: "repo", kind: "AzureBoards", limit: 1 }),
      expected("$.folder", "an absolute path of at most 4096 characters"));
    assert.throws(() => GitMessageReferencesParams.fromJson({ folder: "/r", kind: "AzureBoards", limit: 0 }), expected("$.limit", limit));
    assert.throws(() => GitMessageReferencesParams.fromJson({ folder: "/r", kind: "AzureBoards", limit: 5001 }), expected("$.limit", limit));
    assert.throws(() => new GitMessageReferencesParams("/r", GitMessageReferenceKind.AzureBoards, 1.5), expected("limit", limit));
  });

  it("refuses an unknown kind and a field it doesn't define", () => {
    assert.throws(() => GitMessageReferencesParams.fromJson({ folder: "/r", kind: "GitHub", limit: 1 }), { name: "JsonException", path: "$.kind" });
    assert.throws(() => GitMessageReferencesParams.fromJson({ folder: "/r", kind: "AzureBoards", limit: 1, more: 1 }),
      expected("$.more", "none, since the model doesn't define it"));
  });
});
