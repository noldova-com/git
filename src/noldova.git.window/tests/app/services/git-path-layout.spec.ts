/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import { describe, expect, it } from "vitest";

import { GitFileLayout } from "../../../src/app/enums/git-file-layout.ts";
import type { GitPathEntry } from "../../../src/app/models/git-path-entry.ts";
import { GitPathLayout } from "../../../src/app/services/git-path-layout.ts";

describe("GitPathLayout", () => {
  const paths: readonly string[] = ["README.md", "src/app/b.ts", "Docs/c.md", "src/app/a.ts", "src/main.ts", "src/app/models/m.ts", "deep/one/two/x.ts", "a.ts"];
  const shown = (entries: readonly GitPathEntry<string>[]): readonly string[] =>
    entries.map(t => `${"  ".repeat(t.depth)}${Object.isNull(t.item) ? `+${t.name} (${t.folder})` : `${t.name} = ${t.item}`}`);
  const layout = (kind: GitFileLayout, closed: readonly string[] = []): readonly string[] => shown(GitPathLayout.layout(paths, t => t, kind, new Set(closed)));

  it("lists whole paths in their order without folders", () => {
    expect(layout(GitFileLayout.List, ["Docs"])).toEqual(paths.map(t => `${t} = ${t}`));
  });

  it("puts each folder by its whole path, in name order without case, its files under it in their order, the top's files last, and leaves a closed folder's files out", () => {
    expect(layout(GitFileLayout.Folders, ["Docs"])).toEqual([
      "+deep/one/two (deep/one/two)", "  x.ts = deep/one/two/x.ts",
      "+Docs (Docs)",
      "+src (src)", "  main.ts = src/main.ts",
      "+src/app (src/app)", "  b.ts = src/app/b.ts", "  a.ts = src/app/a.ts",
      "+src/app/models (src/app/models)", "  m.ts = src/app/models/m.ts",
      "README.md = README.md", "a.ts = a.ts"
    ]);
  });

  it("nests folders, each a step in, before the files beside them, joins a folder that holds only one folder with it, and leaves a closed folder's rows out", () => {
    expect(layout(GitFileLayout.Tree)).toEqual([
      "+deep/one/two (deep/one/two)", "  x.ts = deep/one/two/x.ts",
      "+Docs (Docs)", "  c.md = Docs/c.md",
      "+src (src)",
      "  +app (src/app)", "    +models (src/app/models)", "      m.ts = src/app/models/m.ts", "    b.ts = src/app/b.ts", "    a.ts = src/app/a.ts",
      "  main.ts = src/main.ts",
      "README.md = README.md", "a.ts = a.ts"
    ]);
    expect(layout(GitFileLayout.Tree, ["src/app", "deep/one/two"])).toEqual([
      "+deep/one/two (deep/one/two)", "+Docs (Docs)", "  c.md = Docs/c.md", "+src (src)", "  +app (src/app)", "  main.ts = src/main.ts", "README.md = README.md", "a.ts = a.ts"
    ]);
  });

  it("lays nothing out for no items", () => {
    expect(GitPathLayout.layout([], t => t, GitFileLayout.Tree, new Set())).toEqual([]);
  });
});
