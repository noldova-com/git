/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { CachedAnswer } from "../../src/models/cached-answer.ts";

describe("CachedAnswer", () => {
  it("holds an answer's tag, body and read time, and the same answer read again later", () => {
    const answer = new CachedAnswer("\"a\"", "{}", 1_000);

    const again = answer.readAgainAt(61_000);

    assert.deepEqual([answer.tag, answer.body, answer.readAt], ["\"a\"", "{}", 1_000]);
    assert.deepEqual([again.tag, again.body, again.readAt, again === answer], ["\"a\"", "{}", 61_000, false]);
  });
});
