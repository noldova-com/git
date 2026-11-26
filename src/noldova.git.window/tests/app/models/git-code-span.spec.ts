/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import type { ILanguageDefinition, ILineTokenizer, TokenTypeRegistry } from "@noldova/code.editor";
import { CodeEditorRegistries } from "@noldova/code.editor.angular";
import { LineKind } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitCodeSpan } from "../../../src/app/models/git-code-span.ts";
import { GitDiffRow } from "../../../src/app/models/git-diff-row.ts";
import { GitCodeColors } from "../../../src/app/services/git-code-colors.ts";
import { FixtureLine, GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitCodeSpan", () => {
  const rows = (...lines: readonly FixtureLine[]): readonly GitDiffRow[] => GitDiffRow.rowsOf(GitFixtures.diff("a.ts", ...lines).files[0] ?? null);
  const tokenTypes = (): TokenTypeRegistry => TestBed.inject(GitCodeColors).tokenTypes;
  const typescriptAsync = async (): Promise<ILineTokenizer | null> => {
    TestBed.inject(GitCodeColors);
    const registries = TestBed.inject(CodeEditorRegistries).registries;
    const language: ILanguageDefinition | null = registries.languages.find("typescript");
    return Object.isNull(language) ? null : registries.highlighters.tokenizerAsync(language);
  };
  const summary = (spans: readonly (readonly GitCodeSpan[])[]): readonly string[] => spans.map(row => [
    row.filter(t => t.className === "token-comment").map(t => t.text).join(""),
    row.filter(t => t.className === "token-keyword").map(t => t.text).join(",")
  ].join("|"));

  it("cuts each row by the editor's tokenizer behind its plain sign, carrying the new side's state through context and added rows and the old side's through context and removed rows", async () => {
    const tokenizer: ILineTokenizer | null = await typescriptAsync();
    const spans: readonly (readonly GitCodeSpan[])[] = GitCodeSpan.rowsOf(rows(
      new FixtureLine(LineKind.Context, "const a = 1;"), new FixtureLine(LineKind.Removed, "/* old"), new FixtureLine(LineKind.Removed, "end */ let x;"), new FixtureLine(LineKind.Added, "const b = 2;")), tokenizer, tokenTypes());

    expect(summary(spans)).toEqual(["|", "|const", "/* old|", "end */|let", "|const"]);
    expect(spans.map(t => t[0])).toEqual(["@@ -1,1 +1,2 @@", " ", "-", "-", "+"].map(t => new GitCodeSpan(t)));
    expect(spans.map(t => t.map(u => u.text).join(""))).toEqual(rows(
      new FixtureLine(LineKind.Context, "const a = 1;"), new FixtureLine(LineKind.Removed, "/* old"), new FixtureLine(LineKind.Removed, "end */ let x;"), new FixtureLine(LineKind.Added, "const b = 2;")).map(t => t.text));
  });

  it("starts both sides again after a note, and leaves every row one plain run without a tokenizer", async () => {
    const tokenizer: ILineTokenizer | null = await typescriptAsync();
    const diff: readonly GitDiffRow[] = rows(new FixtureLine(LineKind.Context, "/* open"), new FixtureLine(LineKind.NoNewlineAtEnd, ""), new FixtureLine(LineKind.Added, "const b = 2;"), new FixtureLine(LineKind.Added, ""));

    expect(summary(GitCodeSpan.rowsOf(diff, tokenizer, tokenTypes()))).toEqual(["|", "/* open|", "|", "|const", "|"]);
    expect(GitCodeSpan.rowsOf(diff, tokenizer, tokenTypes()).at(-1)).toEqual([new GitCodeSpan("+")]);
    expect(GitCodeSpan.rowsOf(diff, null, tokenTypes())).toEqual(diff.map(t => [new GitCodeSpan(t.text)]));
  });
});
