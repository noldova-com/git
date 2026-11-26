/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, inject, Injectable, signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import type { EditorRegistries, ILanguageDefinition, ILineTokenizer, TokenTypeRegistry } from "@noldova/code.editor";
import { CodeEditorRegistries } from "@noldova/code.editor.angular";
import { TextMateContribution } from "@noldova/code.editor.textmate";

@Injectable({ providedIn: "root" })
export class GitCodeColors {
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly registries: EditorRegistries = inject(CodeEditorRegistries).registries;
  private readonly loading: Set<string> = new Set<string>();
  private readonly loaded: WritableSignal<ReadonlyMap<string, ILineTokenizer | null>> = signal(new Map<string, ILineTokenizer | null>());

  public constructor() {
    const textMate: TextMateContribution = new TextMateContribution();
    if (!this.registries.has(textMate.id))
      this.registries.add(textMate);
  }

  public get tokenTypes(): TokenTypeRegistry {
    return this.registries.tokenTypes;
  }

  public languageOf(path: string | null): string | null {
    return Object.isNull(path) ? null : this.registries.languages.forFile(path)?.id ?? null;
  }

  public tokenizerOf(path: string | null): ILineTokenizer | null {
    const language: ILanguageDefinition | null = Object.isNull(path) ? null : this.registries.languages.forFile(path);
    if (Object.isNull(language))
      return null;
    const loaded: ReadonlyMap<string, ILineTokenizer | null> = this.loaded();
    if (!loaded.has(language.id) && !this.loading.has(language.id))
      this.load(language);
    return loaded.get(language.id) ?? null;
  }

  private load(language: ILanguageDefinition): void {
    this.loading.add(language.id);
    this.registries.highlighters.tokenizerAsync(language).then(tokenizer => this.done(language.id, tokenizer), (error: unknown) => {
      this.done(language.id, null);
      this.errors.handleError(error);
    });
  }

  private done(language: string, tokenizer: ILineTokenizer | null): void {
    this.loaded.update(t => new Map([...t, [language, tokenizer]]));
  }
}
