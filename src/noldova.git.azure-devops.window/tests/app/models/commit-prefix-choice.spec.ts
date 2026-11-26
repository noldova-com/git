/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonValue } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { CommitPrefixChoice } from "../../../src/app/models/commit-prefix-choice.ts";

interface IRefusal {
  readonly json: JsonValue;
  readonly path: string;
}

describe("CommitPrefixChoice", () => {
  it("writes a repository's branch and its work item as JSON and reads them back", () => {
    const choice: CommitPrefixChoice = new CommitPrefixChoice("/work/garden", "users/kim/7532-tag-filter", 7532);

    expect(choice.toJson()).toEqual({ folder: "/work/garden", branch: "users/kim/7532-tag-filter", id: 7532 });
    expect(CommitPrefixChoice.fromJson(JsonReader.fromValue(choice.toJson()))).toEqual(choice);
  });

  it("is for its own repository and branch only", () => {
    const choice: CommitPrefixChoice = new CommitPrefixChoice("/work/garden", "main", 7532);

    expect([choice.isFor("/work/garden", "main"), choice.isFor("/work/site", "main"), choice.isFor("/work/garden", "develop")]).toEqual([true, false, false]);
  });

  it("refuses a blank or missing folder or branch, and an id that isn't a whole number", () => {
    const refusals: readonly IRefusal[] = [{ json: { folder: " ", branch: "main", id: 1 }, path: "$.folder" }, { json: { branch: "main", id: 1 }, path: "$.folder" },
      { json: { folder: "/work/garden", branch: "", id: 1 }, path: "$.branch" }, { json: { folder: "/work/garden", branch: "main", id: 1.5 }, path: "$.id" },
      { json: { folder: "/work/garden", branch: "main", id: "1" }, path: "$.id" }];

    for (const { json, path } of refusals)
      expect(() => CommitPrefixChoice.fromJson(JsonReader.fromValue(json))).toThrow(expect.objectContaining({ name: "JsonException", path }));
  });
});
