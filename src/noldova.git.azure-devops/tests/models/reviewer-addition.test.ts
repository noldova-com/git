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

import { ReviewerAddition } from "../../src/models/reviewer-addition.ts";

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "3411ebc1-d5aa-464f-9615-0b527bc66719", 12);
const addition = { reference: reference.toJson(), descriptor: "aad.TW9uYQ" };

describe("ReviewerAddition", () => {
  it("reads a user's or group's descriptor", () => {
    assert.deepEqual(["aad.TW9uYQ", "vssgp.Uy0xLTktMTU1MTM3NDI0NS0x_=", `msa.${"a".repeat(512)}`].map(t => ReviewerAddition.fromJson({ ...addition, descriptor: t })),
      ["aad.TW9uYQ", "vssgp.Uy0xLTktMTU1MTM3NDI0NS0x_=", `msa.${"a".repeat(512)}`].map(t => new ReviewerAddition(reference, t)));
  });

  it("answers null for a descriptor Graph doesn't make, or another host's, organization's or repository's reference", () => {
    const others = [new HostReference("git-github", "octocat", "hello-world", 12), new HostReference("git-azure-devops", "fab_rikam", reference.repository, 12),
      new HostReference("git-azure-devops", "fabrikam", "site", 12)].map(t => t.toJson());

    assert.deepEqual([...["", "aad", "aad.", "aad TW9uYQ", "aad.TW9u/YQ", "../aad.TW9uYQ", "AAD.TW9uYQ", `aad.${"a".repeat(513)}`]
      .map(t => ReviewerAddition.fromJson({ ...addition, descriptor: t })), ...others.map(t => ReviewerAddition.fromJson({ ...addition, reference: t }))],
    Array.from({ length: 11 }, () => null));
  });

  it("refuses a payload without a reference or a descriptor", () => {
    for (const value of [null, { ...addition, reference: null }, { ...addition, descriptor: 7 }, { reference: addition.reference }])
      assert.throws(() => ReviewerAddition.fromJson(value), JsonException);
  });
});
