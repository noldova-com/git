/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonException } from "@noldova/context.json";
import { HostingFieldException, HostReference, ThreadStatus } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { ThreadChange } from "../../src/models/thread-change.ts";

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "3411ebc1-d5aa-464f-9615-0b527bc66719", 12);
const change = { reference: reference.toJson(), thread: 3, state: "Resolved" };

describe("ThreadChange", () => {
  it("reads a thread's new state, resolved or active again", () => {
    assert.deepEqual([ThreadChange.fromJson(change), ThreadChange.fromJson({ ...change, state: "Active" })],
      [new ThreadChange(reference, 3, ThreadStatus.Resolved), new ThreadChange(reference, 3, ThreadStatus.Active)]);
  });

  it("answers null for another host's, organization's or repository's reference, or a thread below one", () => {
    const others = [new HostReference("git-github", "octocat", "hello-world", 12), new HostReference("git-azure-devops", "fab_rikam", reference.repository, 12),
      new HostReference("git-azure-devops", "fabrikam", "site", 12)].map(t => t.toJson());

    assert.deepEqual([...others.map(t => ThreadChange.fromJson({ ...change, reference: t })), ThreadChange.fromJson({ ...change, thread: 0 }),
      ThreadChange.fromJson({ ...change, thread: -1 })], [null, null, null, null, null]);
  });

  it("refuses a payload without a reference or a whole thread, an invalid reference, or a state it can't write", () => {
    for (const value of [null, { ...change, reference: null }, { ...change, thread: 1.5 }, { ...change, state: null }])
      assert.throws(() => ThreadChange.fromJson(value), JsonException);
    assert.throws(() => ThreadChange.fromJson({ ...change, reference: { ...change.reference, number: 0 } }), HostingFieldException);
    for (const state of ["Closed", "WontFix", "fixed", "Pending"])
      assert.throws(() => ThreadChange.fromJson({ ...change, state }), JsonException);
  });
});
