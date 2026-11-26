/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type ILineTokenizer, type ITokenizerState, type LineTokens, type TokenTypeRegistry, TokenStyles } from "@noldova/code.editor";

import { GitDiffRowKind } from "../enums/git-diff-row-kind.ts";
import { Resources } from "../../resources.ts";
import type { GitDiffRow } from "./git-diff-row.ts";

export class GitCodeSpan {
  public readonly text: string;
  public readonly className: string;

  public constructor(text: string, className: string = "") {
    this.text = text;
    this.className = className;
  }

  public static rowsOf(rows: readonly GitDiffRow[], tokenizer: ILineTokenizer | null, tokenTypes: TokenTypeRegistry): readonly (readonly GitCodeSpan[])[] {
    if (Object.isNull(tokenizer))
      return rows.map(t => [new GitCodeSpan(t.text)]);
    let older: ITokenizerState = tokenizer.initialState;
    let newer: ITokenizerState = tokenizer.initialState;
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
      return [new GitCodeSpan(sign), ...GitCodeSpan.spansOf(code, tokens, tokenTypes)];
    });
  }

  private static spansOf(code: string, tokens: LineTokens, tokenTypes: TokenTypeRegistry): readonly GitCodeSpan[] {
    const spans: GitCodeSpan[] = [];
    let at: number = 0;
    for (const token of tokens.tokens) {
      if (token.start > at)
        spans.push(new GitCodeSpan(code.slice(at, token.start)));
      spans.push(new GitCodeSpan(code.slice(token.start, token.end), TokenStyles.classesOf(tokenTypes, token.type, token.modifiers, Resources.tokenClassPrefix).toArray().join(" ")));
      at = token.end;
    }
    if (at < code.length)
      spans.push(new GitCodeSpan(code.slice(at)));
    return spans;
  }
}
