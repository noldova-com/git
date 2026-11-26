/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitPathEntry } from "../../../src/app/models/git-path-entry.ts";

describe("GitPathEntry", () => {
  it("holds a folder row with its whole path and no item, and an item row with its item and no folder, each at its depth", () => {
    const folder: GitPathEntry<string> = new GitPathEntry<string>("src/app", "app", 1, null);
    const item: GitPathEntry<string> = new GitPathEntry<string>("", "a.ts", 2, "src/app/a.ts");

    expect([folder.folder, folder.name, folder.depth, folder.item, item.folder, item.name, item.depth, item.item]).toEqual([
      "src/app", "app", 1, null, "", "a.ts", 2, "src/app/a.ts"
    ]);
  });
});
