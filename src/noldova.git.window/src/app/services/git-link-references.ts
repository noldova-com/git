/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Injector, signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import type { ILinkReferenceSource } from "@noldova/ui.components.angular";

import type { IGitLinkReferences } from "../interfaces/i-git-link-references.ts";
import { GitLinkReferenceSet } from "./git-link-reference-set.ts";

export class GitLinkReferences {
  private static readonly provided: WritableSignal<readonly IGitLinkReferences[]> = signal([]);

  public static provide(references: IGitLinkReferences): () => void {
    GitLinkReferences.provided.update(t => [...t, references]);
    return () => GitLinkReferences.provided.update(t => t.filter(u => u !== references));
  }

  public static opens(folder: string, url: string, injector: Injector): boolean {
    return GitLinkReferences.provided().some(t => t.opens?.(folder, url, injector) === true);
  }

  public static of(folder: string): ILinkReferenceSource | null {
    const sources: ILinkReferenceSource[] = [];
    for (const provided of GitLinkReferences.provided()) {
      const source = provided.referencesFor(folder);
      if (!Object.isNull(source))
        sources.push(source);
    }
    return sources.length > 1 ? new GitLinkReferenceSet(sources) : sources[0] ?? null;
  }
}
