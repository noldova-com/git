/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, inject, Injectable, signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { CodeLanguage, ShikiLineTokenizer } from "@noldova/editor.angular";

/**
 * The editor's tokenizers, which color a file's code as the merge editor does: each language's tokenizer loads once, the first time a
 * screen asks for a file in it, and every screen of the window shares it until the window closes.
 */
@Injectable({ providedIn: "root" })
export class GitCodeColors {
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly loading: Map<string, Promise<ShikiLineTokenizer | null>> = new Map<string, Promise<ShikiLineTokenizer | null>>();
  private readonly loaded: WritableSignal<ReadonlyMap<string, ShikiLineTokenizer | null>> = signal(new Map<string, ShikiLineTokenizer | null>());

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.loading.forEach(t => void t.then(tokenizer => tokenizer?.[Symbol.dispose](), () => undefined)));
  }

  /**
   * The tokenizer of the path's language, or `null` with no path, while it loads, when no language fits the path, or when it failed to
   * load, which goes to the error handler; read in a computed or an effect, it follows the load.
   */
  public tokenizerOf(path: string | null): ShikiLineTokenizer | null {
    const language: string | null = Object.isNull(path) ? null : CodeLanguage.forPath(path)?.id ?? null;
    if (Object.isNull(language))
      return null;
    const loaded: ReadonlyMap<string, ShikiLineTokenizer | null> = this.loaded();
    if (!loaded.has(language) && !this.loading.has(language))
      this.load(language);
    return loaded.get(language) ?? null;
  }

  private load(language: string): void {
    const loading: Promise<ShikiLineTokenizer | null> = ShikiLineTokenizer.createAsync(language);
    this.loading.set(language, loading);
    loading.then(tokenizer => this.done(language, tokenizer), (error: unknown) => {
      this.done(language, null);
      this.errors.handleError(error);
    });
  }

  private done(language: string, tokenizer: ShikiLineTokenizer | null): void {
    this.loaded.update(t => new Map([...t, [language, tokenizer]]));
  }
}
