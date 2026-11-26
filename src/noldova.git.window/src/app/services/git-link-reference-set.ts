/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";
import "@noldova/context.core";
import type { ILinkReferenceSource, LinkReference, LinkReferenceMatch } from "@noldova/ui.components.angular";

export class GitLinkReferenceSet implements ILinkReferenceSource {
  private readonly sources: readonly ILinkReferenceSource[];

  public constructor(sources: readonly ILinkReferenceSource[]) {
    this.sources = sources;
  }

  public find(url: string, text: string): Signal<LinkReference | null> | null {
    for (const source of this.sources) {
      const found = source.find(url, text);
      if (!Object.isNull(found))
        return found;
    }
    return null;
  }

  public findText(text: string): readonly LinkReferenceMatch[] {
    const matches = this.sources.flatMap(t => t.findText?.(text) ?? []).sort((a, b) => a.start - b.start);
    let end = 0;
    return matches.filter(t => {
      if (t.start < end)
        return false;
      end = t.start + t.length;
      return true;
    });
  }
}
