/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import type { GitBranchRow } from "../../../src/app/models/git-branch-row.ts";
import { GitBranchTree } from "../../../src/app/services/git-branch-tree.ts";

describe("GitBranchTree", () => {
  const branches: readonly string[] = ["origin/main", "origin/team/b", "origin/Team2/x", "origin/team/a", "origin/team", "origin/deep/one/two", "upstream/main"];
  const shown = (rows: readonly GitBranchRow[]): readonly string[] => rows.map(t => `${"  ".repeat(t.depth)}${t.isFolder ? "+" : "-"}${t.name}${t.count > 0 ? ` ${t.count}` : ""}`);

  it("shows each remote closed, a level in from its section, with how many branches it holds", () => {
    expect(shown(GitBranchTree.remoteRowsOf(["origin", "upstream", "empty"], branches, new Set()))).toEqual(["  +origin 6", "  +upstream 1", "  +empty"]);
  });

  it("shows an open remote's folders first and then its branches, each by name ignoring case, and an open folder's contents", () => {
    const rows: readonly GitBranchRow[] = GitBranchTree.remoteRowsOf(["origin"], branches, new Set(["origin/", "origin/team/", "origin/deep/", "origin/deep/one/"]));

    expect(shown(rows)).toEqual(["  +origin 6", "    +deep", "      +one", "        -two", "    +team", "      -a", "      -b", "    +Team2", "    -main", "    -team"]);
    expect(rows.map(t => t.key)).toEqual([
      "origin/", "origin/deep/", "origin/deep/one/", "origin/deep/one/two", "origin/team/", "origin/team/a", "origin/team/b", "origin/Team2/", "origin/main", "origin/team"
    ]);
  });

  it("names each remote branch row's whole branch, and no branch for a folder", () => {
    const rows: readonly GitBranchRow[] = GitBranchTree.remoteRowsOf(["origin"], branches, new Set(["origin/", "origin/team/"]));

    expect(rows.map(t => t.branch)).toEqual(["", "", "", "origin/team/a", "origin/team/b", "", "origin/main", "origin/team"]);
  });

  it("shows local folders first, a level in from their section, and then branches, each by name ignoring case, with an open folder's contents and each branch's whole name", () => {
    const local: readonly string[] = ["staging", "rr/ai-ui", "develop", "rr/data/cells", "Rs/x"];
    const closed: readonly GitBranchRow[] = GitBranchTree.localRowsOf("refs/heads/", local, new Set());
    const open: readonly GitBranchRow[] = GitBranchTree.localRowsOf("refs/heads/", local, new Set(["refs/heads/rr/", "refs/heads/rr/data/"]));

    expect(shown(closed)).toEqual(["  +rr", "  +Rs", "  -develop", "  -staging"]);
    expect(shown(open)).toEqual(["  +rr", "    +data", "      -cells", "    -ai-ui", "  +Rs", "  -develop", "  -staging"]);
    expect(open.map(t => t.key)).toEqual([
      "refs/heads/rr/", "refs/heads/rr/data/", "refs/heads/rr/data/cells", "refs/heads/rr/ai-ui", "refs/heads/Rs/", "refs/heads/develop", "refs/heads/staging"
    ]);
    expect(open.map(t => t.branch)).toEqual(["", "", "rr/data/cells", "rr/ai-ui", "", "develop", "staging"]);
  });
});
