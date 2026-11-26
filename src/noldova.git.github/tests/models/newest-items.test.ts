/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonReader } from "@noldova/context.json";
import { describe, it } from "vitest";

import { NewestItems } from "../../src/models/newest-items.ts";

describe("NewestItems", () => {
  it("keeps the newest items read, oldest first, and that older ones were left out", () => {
    const items: readonly JsonReader[] = [JsonReader.fromValue({ id: 2 }), JsonReader.fromValue({ id: 3 })];
    const newest: NewestItems = new NewestItems(items, true);

    assert.deepEqual([newest.items.map(t => t.readInteger("id")), newest.hasMore], [[2, 3], true]);
  });

  it("keeps an empty read with nothing older", () => {
    const newest: NewestItems = new NewestItems([], false);

    assert.deepEqual([newest.items, newest.hasMore], [[], false]);
  });
});
