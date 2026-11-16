/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { describe, test } from "vitest";

import { WatchCookie } from "../../src/models/watch-cookie.ts";

describe("WatchCookie", () => {
  test("names its file in its folder and is neither written nor seen until marked", async () => {
    const cookie = new WatchCookie("/r/.git", "noldova-watch-1f");

    assert.deepEqual([cookie.folder, cookie.name, cookie.file, cookie.isWritten, cookie.isSeen], ["/r/.git", "noldova-watch-1f", path.join("/r/.git", "noldova-watch-1f"), false, false]);
    cookie.markSeen();
    assert.equal(cookie.isSeen, true);
    assert.equal(await cookie.seen.promise, undefined);
  });
});
