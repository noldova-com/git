/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { HostingFieldException, HostReference } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { ThreadReply } from "../../src/models/thread-reply.ts";

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "3411ebc1-d5aa-464f-9615-0b527bc66719", 12);
const reply = { reference: reference.toJson(), thread: 3, parent: 1, body: "Fixed." };

describe("ThreadReply", () => {
  it("reads a reply to a thread's comment", () => {
    assert.deepEqual(ThreadReply.fromJson(reply), new ThreadReply(reference, 3, 1, "Fixed."));
  });

  it("answers null for another host's, organization's or repository's reference, an id below one or a reply longer than Azure DevOps keeps", () => {
    const others = [new HostReference("git-github", "octocat", "hello-world", 12), new HostReference("git-azure-devops", "fab_rikam", reference.repository, 12),
      new HostReference("git-azure-devops", "fabrikam", "site", 12)].map(t => t.toJson());

    assert.deepEqual([...others.map(t => ThreadReply.fromJson({ ...reply, reference: t })), ThreadReply.fromJson({ ...reply, thread: 0 }),
      ThreadReply.fromJson({ ...reply, parent: 0 }), ThreadReply.fromJson({ ...reply, body: "x".repeat(150_001) })], [null, null, null, null, null, null]);
    assert.ok(!Object.isNull(ThreadReply.fromJson({ ...reply, body: "x".repeat(150_000) })));
  });

  it("refuses a payload without a reference, a whole id or a text that isn't blank", () => {
    for (const value of [null, { ...reply, reference: null }, { ...reply, thread: 1.5 }, { ...reply, body: " " }])
      assert.throws(() => ThreadReply.fromJson(value), JsonException);
    assert.throws(() => ThreadReply.fromJson({ ...reply, reference: { ...reply.reference, number: 0 } }), HostingFieldException);
  });
});
