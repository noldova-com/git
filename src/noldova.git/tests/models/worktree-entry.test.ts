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

import { WorktreeEntry } from "../../src/models/worktree-entry.ts";

describe("WorktreeEntry", () => {
  test("is at a folder spelled with other separators or a trailing separator", () => {
    const folder = path.resolve("work", "a");
    const entry = new WorktreeEntry(folder.split(path.sep).join("/"), null, null, null, false);

    assert.equal(entry.isAt(`${folder}${path.sep}`), true);
    assert.equal(entry.isAt(path.resolve("work", "b")), false);
  });

  test("is locked elsewhere only when locked with another reason", () => {
    assert.equal(new WorktreeEntry("/w", null, null, null, false).isLockedElsewhere("ours"), false);
    assert.equal(new WorktreeEntry("/w", null, null, "ours", false).isLockedElsewhere("ours"), false);
    assert.equal(new WorktreeEntry("/w", null, null, "", false).isLockedElsewhere("ours"), true);
    assert.equal(new WorktreeEntry("/w", null, null, "other-tool", false).isLockedElsewhere("ours"), true);
  });
});
