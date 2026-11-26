/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileState } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitFileGroupKind } from "../../../src/app/enums/git-file-group-kind.ts";
import { GitFileItem } from "../../../src/app/models/git-file-item.ts";
import { GitFileRow } from "../../../src/app/models/git-file-row.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitFileItem", () => {
  it("holds a folder line with its whole path and no file, and a file line with its file and no folder, each at its depth", () => {
    const file: GitFileRow = new GitFileRow(GitFileGroupKind.Changes, GitFixtures.entry("src/app/a.ts", FileState.Unmodified, FileState.Modified));
    const folder: GitFileItem = new GitFileItem("src/app/", "src/app", "app", null, 1);
    const item: GitFileItem = new GitFileItem("src/app/a.ts", "", "a.ts", file, 2);

    expect([folder.key, folder.folder, folder.name, folder.row, folder.depth, item.key, item.folder, item.name, item.row, item.depth]).toEqual([
      "src/app/", "src/app", "app", null, 1, "src/app/a.ts", "", "a.ts", file, 2
    ]);
  });
});
