/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ILineTokenizer } from "@noldova/editor.angular";

import { GitDiffRowKind } from "../enums/git-diff-row-kind.ts";
import { Resources } from "../../resources.ts";
import type { GitDiffRow } from "./git-diff-row.ts";

type TokenizerState = ILineTokenizer["initialState"];
type LineTokens = ReturnType<ILineTokenizer["tokenizeLine"]>;

/** A run of a diff row's text, with the class that colors it as its token kind, or an empty class for plain text. */
export class GitCodeSpan {
  public readonly text: string;
  public readonly className: string;

  public constructor(text: string, className: string = "") {
    this.text = text;
    this.className = className;
  }

  /**
   * Each row of a diff cut into runs by the tokenizer, its sign plain. The new side's state carries through context and added rows and
   * the old side's through context and removed rows, as each side's file reads; a hunk's header or a note starts both again. Without a
   * tokenizer each row is one plain run.
   */
  public static rowsOf(rows: readonly GitDiffRow[], tokenizer: ILineTokenizer | null): readonly (readonly GitCodeSpan[])[] {
    if (tokenizer === null)
      return rows.map(t => [new GitCodeSpan(t.text)]);
    let older: TokenizerState = tokenizer.initialState;
    let newer: TokenizerState = tokenizer.initialState;
    return rows.map(row => {
      if (row.kind === GitDiffRowKind.Meta) {
        older = tokenizer.initialState;
        newer = tokenizer.initialState;
        return [new GitCodeSpan(row.text)];
      }
      const sign: string = row.kind === GitDiffRowKind.Added ? Resources.addedPrefix : row.kind === GitDiffRowKind.Removed ? Resources.removedPrefix : Resources.contextPrefix;
      const code: string = row.text.slice(sign.length);
      const tokens: LineTokens = tokenizer.tokenizeLine(code, row.kind === GitDiffRowKind.Removed ? older : newer);
      if (row.kind !== GitDiffRowKind.Removed)
        newer = tokens.endState;
      if (row.kind !== GitDiffRowKind.Added)
        older = tokens.endState;
      return [new GitCodeSpan(sign), ...GitCodeSpan.spansOf(code, tokens)];
    });
  }

  private static spansOf(code: string, tokens: LineTokens): readonly GitCodeSpan[] {
    const spans: GitCodeSpan[] = [];
    let at: number = 0;
    for (const token of tokens.tokens) {
      if (token.start > at)
        spans.push(new GitCodeSpan(code.slice(at, token.start)));
      spans.push(new GitCodeSpan(code.slice(token.start, token.end), `token-${token.kind.toLowerCase()}`));
      at = token.end;
    }
    if (at < code.length)
      spans.push(new GitCodeSpan(code.slice(at)));
    return spans;
  }
}
