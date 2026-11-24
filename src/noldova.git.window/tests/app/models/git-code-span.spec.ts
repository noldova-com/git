/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ShikiLineTokenizer } from "@noldova/editor.angular";
import { LineKind } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitCodeSpan } from "../../../src/app/models/git-code-span.ts";
import { GitDiffRow } from "../../../src/app/models/git-diff-row.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitCodeSpan", () => {
  const rows = (...lines: readonly [LineKind, string][]): readonly GitDiffRow[] => GitDiffRow.rowsOf(GitFixtures.diff("a.ts", ...lines).files[0] ?? null);
  const typescriptAsync = async (): Promise<ShikiLineTokenizer | null> => {
    const tokenizer: ShikiLineTokenizer | null = await ShikiLineTokenizer.createAsync("typescript");
    onTestFinished(() => tokenizer?.[Symbol.dispose]());
    return tokenizer;
  };
  const summary = (spans: readonly (readonly GitCodeSpan[])[]): readonly string[] => spans.map(row => [
    row.filter(t => t.className === "token-comment").map(t => t.text).join(""),
    row.filter(t => t.className === "token-keyword").map(t => t.text).join(",")
  ].join("|"));

  it("cuts each row by the editor's tokenizer behind its plain sign, carrying the new side's state through context and added rows and the old side's through context and removed rows", async () => {
    const tokenizer: ShikiLineTokenizer | null = await typescriptAsync();
    const spans: readonly (readonly GitCodeSpan[])[] = GitCodeSpan.rowsOf(rows(
      [LineKind.Context, "const a = 1;"], [LineKind.Removed, "/* old"], [LineKind.Removed, "end */ let x;"], [LineKind.Added, "const b = 2;"]), tokenizer);

    expect(summary(spans)).toEqual(["|", "|const", "/* old|", "end */|let", "|const"]);
    expect(spans.map(t => t[0])).toEqual(["@@ -1,1 +1,2 @@", " ", "-", "-", "+"].map(t => new GitCodeSpan(t)));
    expect(spans.map(t => t.map(u => u.text).join(""))).toEqual(rows(
      [LineKind.Context, "const a = 1;"], [LineKind.Removed, "/* old"], [LineKind.Removed, "end */ let x;"], [LineKind.Added, "const b = 2;"]).map(t => t.text));
  });

  it("starts both sides again after a note, and leaves every row one plain run without a tokenizer", async () => {
    const tokenizer: ShikiLineTokenizer | null = await typescriptAsync();
    const diff: readonly GitDiffRow[] = rows([LineKind.Context, "/* open"], [LineKind.NoNewlineAtEnd, ""], [LineKind.Added, "const b = 2;"], [LineKind.Added, ""]);

    expect(summary(GitCodeSpan.rowsOf(diff, tokenizer))).toEqual(["|", "/* open|", "|", "|const", "|"]);
    expect(GitCodeSpan.rowsOf(diff, tokenizer).at(-1)).toEqual([new GitCodeSpan("+")]);
    expect(GitCodeSpan.rowsOf(diff, null)).toEqual(diff.map(t => [new GitCodeSpan(t.text)]));
  });
});
