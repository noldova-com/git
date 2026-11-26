/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonException } from "@noldova/context.json";
import { HostReference } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { PeopleQuery } from "../../src/models/people-query.ts";

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "3411ebc1-d5aa-464f-9615-0b527bc66719", 12);
const search = { reference: reference.toJson(), query: "mona" };

describe("PeopleQuery", () => {
  it("reads a search of 3 to 100 characters, trimmed", () => {
    assert.deepEqual([" mon ", "m".repeat(100)].map(t => PeopleQuery.fromJson({ ...search, query: t })),
      [new PeopleQuery(reference, "mon"), new PeopleQuery(reference, "m".repeat(100))]);
  });

  it("answers null for a shorter or longer search, or another host's, organization's or repository's reference", () => {
    const others = [new HostReference("git-github", "octocat", "hello-world", 12), new HostReference("git-azure-devops", "fab_rikam", reference.repository, 12),
      new HostReference("git-azure-devops", "fabrikam", "site", 12)].map(t => t.toJson());

    assert.deepEqual([...[" mo ", "m".repeat(101)].map(t => PeopleQuery.fromJson({ ...search, query: t })),
      ...others.map(t => PeopleQuery.fromJson({ ...search, reference: t }))], [null, null, null, null, null]);
  });

  it("refuses a payload without a reference or a search", () => {
    for (const value of [null, { ...search, reference: null }, { ...search, query: 3 }, { reference: search.reference }])
      assert.throws(() => PeopleQuery.fromJson(value), JsonException);
  });
});
