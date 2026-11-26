/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitCommitFileRow } from "../../../src/app/models/git-commit-file-row.ts";

describe("GitCommitFileRow", () => {
  it("holds a folder without counts, a renamed file with its old path and similarity, and a binary file without line counts", () => {
    const rows: readonly GitCommitFileRow[] = [
      new GitCommitFileRow("src", "src", "", true, 0, "", null, null),
      new GitCommitFileRow("src/b.ts", "b.ts", "src/a.ts", false, 1, "R 92%", 4, 2),
      new GitCommitFileRow("logo.png", "logo.png", "", false, 0, "A", null, null)
    ];

    expect(rows.map(t => [t.key, t.name, t.from, t.isFolder, t.depth, t.letter, t.added, t.removed])).toEqual([
      ["src", "src", "", true, 0, "", null, null], ["src/b.ts", "b.ts", "src/a.ts", false, 1, "R 92%", 4, 2], ["logo.png", "logo.png", "", false, 0, "A", null, null]
    ]);
  });
});
