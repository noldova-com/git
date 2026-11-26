/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it, onTestFinished } from "vitest";

import { GitResolvedBy } from "../../../src/app/enums/git-resolved-by.ts";
import { GitResolving } from "../../../src/app/services/git-resolving.ts";

describe("GitResolving", () => {
  it("keeps each folder's opened file and resolutions apart, and forgets only the folder whose operation ended", () => {
    onTestFinished(() => {
      GitResolving.opened.set(new Map());
      GitResolving.resolutions.set(new Map());
    });

    GitResolving.open("/work/a", "x.ts");
    GitResolving.open("/work/b", "y.ts");
    GitResolving.open("/work/a", "z.ts");
    GitResolving.record("/work/a", "x.ts", GitResolvedBy.Ours);
    GitResolving.record("/work/a", "x.ts", GitResolvedBy.Theirs);
    GitResolving.record("/work/b", "y.ts", GitResolvedBy.Deleted);
    const kept: ReadonlyMap<string, ReadonlyMap<string, GitResolvedBy>> = GitResolving.resolutions();
    GitResolving.forget("/work/c");
    const unchanged: boolean = GitResolving.resolutions() === kept;
    GitResolving.forget("/work/a");

    expect([GitResolving.pathOf("/work/a"), GitResolving.pathOf("/work/b"), GitResolving.pathOf("/work/c")]).toEqual(["z.ts", "y.ts", null]);
    expect(unchanged).toBe(true);
    expect([[...GitResolving.resolutionsOf("/work/a")], [...GitResolving.resolutionsOf("/work/b")]]).toEqual([[], [["y.ts", "Deleted"]]]);
  });
});
