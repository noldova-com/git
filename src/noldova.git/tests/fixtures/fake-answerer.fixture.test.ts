/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { PermissionDecision, PermissionOption, PermissionQuestion, ToolRisk } from "@noldova/desktop.runtime";

import { FakeAnswerer } from "./fake-answerer.fixture.ts";

describe("FakeAnswerer", () => {
  const question = new PermissionQuestion("git", "session-1", "conversation-1",
    { action: "git.stage", title: "Stage a.txt", details: [], risk: ToolRisk.Low, options: [PermissionOption.AllowOnce, PermissionOption.Deny] });

  test("answers the decisions queued, in order, and records each request", async () => {
    const answerer = new FakeAnswerer();
    answerer.answerNext(PermissionDecision.AllowedOnce, PermissionDecision.Denied);

    const answers = [await answerer.answerAsync(question, new AbortController().signal), await answerer.answerAsync(question, new AbortController().signal)];

    assert.deepEqual([answers, answerer.requests.map(t => t.action)], [[PermissionDecision.AllowedOnce, PermissionDecision.Denied], ["git.stage", "git.stage"]]);
  });

  test("fails a question nobody queued an answer for, rather than answering it Denied", async () => {
    await assert.rejects(new FakeAnswerer().answerAsync(question, new AbortController().signal), (error: unknown) => error instanceof UnansweredCallException);
  });
});
