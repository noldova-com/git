/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostPerson, HostReviewer } from "../../src/api/index.ts";

const person: HostPerson = new HostPerson("monalisa", null, null);
const approved: HostReviewer = new HostReviewer(person, 1, "Approved", true);

describe("HostReviewer", () => {
  it("takes a vote from -1 to 1 with the host's own label, and returns itself as JSON that reads back the same", () => {
    assert.deepEqual(approved.toJson(), { person: { login: "monalisa", avatar: null, url: null }, vote: 1, voteLabel: "Approved", isRequired: true });
    for (const reviewer of [approved, new HostReviewer(person, 0.5, "Approved with suggestions", false), new HostReviewer(person, -1, "Rejected", false),
      new HostReviewer(person, 0, "No vote", false)])
      assert.deepEqual(HostReviewer.fromJson(reviewer.toJson()), reviewer);
  });

  it("refuses a vote outside -1 to 1 or not a number, and a blank label, naming the parameter", () => {
    for (const vote of [1.5, -2, Number.NaN, Number.POSITIVE_INFINITY])
      assert.throws(() => new HostReviewer(person, vote, "Approved", false), { name: "HostingArgumentException", parameterName: "vote" });
    assert.throws(() => new HostReviewer(person, 1, " ", false), { name: "HostingArgumentException", parameterName: "voteLabel" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    assert.throws(() => HostReviewer.fromJson({ ...approved.toJson(), id: "a" }), { name: "HostingFieldException", field: "$.id" });
    assert.throws(() => HostReviewer.fromJson({ ...approved.toJson(), vote: 10 }, "$.reviewers.0"), { name: "HostingFieldException", field: "$.reviewers.0.vote" });
    assert.throws(() => HostReviewer.fromJson({ ...approved.toJson(), person: { login: " ", avatar: null, url: null } }),
      { name: "HostingFieldException", field: "$.person.login" });
    assert.throws(() => HostReviewer.fromJson({ ...approved.toJson(), isRequired: "yes" }), { name: "JsonException", path: "$.isRequired" });
  });
});
