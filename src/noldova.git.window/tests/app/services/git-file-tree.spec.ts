/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { FileState } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitFileGroupKind } from "../../../src/app/enums/git-file-group-kind.ts";
import { GitFileLayout } from "../../../src/app/enums/git-file-layout.ts";
import type { GitFileItem } from "../../../src/app/models/git-file-item.ts";
import { GitFileRow } from "../../../src/app/models/git-file-row.ts";
import { GitFileTree } from "../../../src/app/services/git-file-tree.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitFileTree", () => {
  const rows: readonly GitFileRow[] = ["README.md", "src/app/b.ts", "Docs/c.md", "src/a.ts"]
    .map(t => new GitFileRow(GitFileGroupKind.Changes, GitFixtures.entry(t, FileState.Unmodified, FileState.Modified)));
  const shown = (items: readonly GitFileItem[]): readonly string[] =>
    items.map(t => `${"  ".repeat(t.depth)}${Object.isNull(t.row) ? `+${t.name} ${t.key}` : `${t.name} ${t.key}`}`);

  it("lists whole paths, each by its row's key", () => {
    expect(shown(GitFileTree.itemsOf(rows, GitFileLayout.List, new Set()))).toEqual(rows.map(t => `${t.path} ${t.key}`));
  });

  it("keys a folder apart from the files and lays the rows out as a tree or by folder", () => {
    expect(shown(GitFileTree.itemsOf(rows, GitFileLayout.Tree, new Set(["Docs"])))).toEqual([
      "+Docs folder:Docs", "+src folder:src", "  +app folder:src/app", `    b.ts ${rows[1]?.key}`, `  a.ts ${rows[3]?.key}`, `README.md ${rows[0]?.key}`
    ]);
    expect(shown(GitFileTree.itemsOf(rows, GitFileLayout.Folders, new Set())).filter(t => t.includes("+"))).toEqual(["+Docs folder:Docs", "+src folder:src", "+src/app folder:src/app"]);
  });
});
