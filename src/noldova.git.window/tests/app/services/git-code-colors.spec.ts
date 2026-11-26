/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { ILineTokenizer } from "@noldova/code.editor";
import { CodeEditorRegistries } from "@noldova/code.editor.angular";
import { TextMateContribution } from "@noldova/code.editor.textmate";
import { describe, expect, it, vi } from "vitest";

import { GitCodeColors } from "../../../src/app/services/git-code-colors.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";

describe("GitCodeColors", () => {
  it("gives no language or tokenizer with no path or for a path no language fits, and loads none for them", () => {
    const colors: GitCodeColors = TestBed.inject(GitCodeColors);
    const created = vi.spyOn(TestBed.inject(CodeEditorRegistries).registries.highlighters, "tokenizerAsync");

    expect([colors.languageOf(null), colors.languageOf("notes.cobol"), colors.tokenizerOf(null), colors.tokenizerOf("README"), colors.tokenizerOf("notes.cobol"),
      created.mock.calls.length]).toEqual([null, null, null, null, null, 0]);
  });

  it("adds the TextMate grammars to the window's editor registries once, and names a path's language by them", () => {
    const registries = TestBed.inject(CodeEditorRegistries).registries;
    const textMate: string = new TextMateContribution().id;
    const before: boolean = registries.has(textMate);
    const added = vi.spyOn(registries, "add");
    const colors: GitCodeColors = TestBed.inject(GitCodeColors);
    TestBed.runInInjectionContext(() => new GitCodeColors());

    expect([before, added.mock.calls.length, registries.has(textMate), colors.languageOf("src/a.ts"), colors.tokenTypes])
      .toEqual([false, 1, true, "typescript", registries.tokenTypes]);
  });

  it("loads one tokenizer a language and gives it once it is ready", async () => {
    const colors: GitCodeColors = TestBed.inject(GitCodeColors);
    const created = vi.spyOn(TestBed.inject(CodeEditorRegistries).registries.highlighters, "tokenizerAsync");

    const first: ILineTokenizer | null = colors.tokenizerOf("src/a.ts");
    colors.tokenizerOf("src/b.ts");
    await Wait.until(() => !Object.isNull(colors.tokenizerOf("src/a.ts")));

    expect([first, created.mock.calls.map(t => t[0].id), colors.tokenizerOf("src/c.ts")?.initialState]).toEqual([null, ["typescript"], expect.anything()]);
  });

  it("reports a tokenizer that fails to load, and leaves its language plain", async () => {
    const handled: unknown[] = [];
    const broken: Error = new Error("The grammar didn't load.");
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(error));
    const colors: GitCodeColors = TestBed.inject(GitCodeColors);
    vi.spyOn(TestBed.inject(CodeEditorRegistries).registries.highlighters, "tokenizerAsync").mockRejectedValueOnce(broken);

    colors.tokenizerOf("a.py");
    await Wait.until(() => handled.length === 1);

    expect([handled, colors.tokenizerOf("a.py")]).toEqual([[broken], null]);
  });
});
