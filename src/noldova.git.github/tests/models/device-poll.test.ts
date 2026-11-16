/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { DevicePoll } from "../../src/models/device-poll.ts";

describe("DevicePoll", () => {
  it("answers a pending poll, a slow-down with or without GitHub's interval, and a granted token", () => {
    const polls = [DevicePoll.pending(), DevicePoll.slowedDown(10_000), DevicePoll.slowedDown(null), DevicePoll.granted("gho_token")];

    assert.deepEqual(polls.map(t => [t.token, t.slowDown, t.interval]), [[null, false, null], [null, true, 10_000], [null, true, null], ["gho_token", false, null]]);
  });
});
