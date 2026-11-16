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
import { GitFileRow } from "../../../src/app/models/git-file-row.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitFileRow", () => {
  it.each([
    ["", ""],
    ["src/", "src/"],
    ["src/acp/", "src/acp/"],
    ["x/.config/y/", "x/.config/y/"],
    ["src/Example.Project.Core/src/", "src/…/Core/src/"],
    ["src/Example.Project.Agents/acp/", "src/…/Agents/acp/"],
    ["src/app/components/git-view/", "src/…/git-view/"],
    ["src/Example.Project.Window/src/app/enums/", "src/…/app/enums/"]
  ])("shows the folder %j as %j: its first folder, then the last ones that fit, a dotted name by its last part", (directory, shown) => {
    const row: GitFileRow = new GitFileRow(GitFileGroupKind.Changes, GitFixtures.entry(`${directory}file.ts`, FileState.Unmodified, FileState.Modified));

    expect([row.directory, row.fileName]).toEqual([shown, "file.ts"]);
  });
});
