/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";
import "@noldova/context.core";
import type { ILinkReferenceSource, LinkReference } from "@noldova/ui.components.angular";
import { GitTextAround } from "./git-text-around.ts";

export class GitReferencePart {
  public readonly text: string;
  public readonly url: string | null;
  public readonly reference: Signal<LinkReference | null> | null;

  public constructor(text: string, url: string | null = null, reference: Signal<LinkReference | null> | null = null) {
    this.text = text;
    this.url = url;
    this.reference = reference;
  }

  public static of(text: string, source: ILinkReferenceSource | null): readonly GitReferencePart[] {
    if (Object.isNull(source))
      return [new GitReferencePart(text)];
    const parts: GitReferencePart[] = [];
    let at = 0;
    for (const match of [...source.findText?.(text) ?? []].sort((a, b) => a.start - b.start)) {
      if (match.start < at)
        continue;
      if (match.start > at)
        parts.push(new GitReferencePart(text.slice(at, match.start)));
      const written = text.slice(match.start, match.start + match.length);
      parts.push(new GitReferencePart(written, match.url, source.find(match.url, written)));
      at = match.start + match.length;
    }
    if (at < text.length || parts.length === 0)
      parts.push(new GitReferencePart(text.slice(at)));
    return parts;
  }

  public static around(text: string, linked: string): GitTextAround {
    const at = text.indexOf(linked);
    return at < 0 ? new GitTextAround("", text, "") : new GitTextAround(text.slice(0, at), linked, text.slice(at + linked.length));
  }

  public static linked(text: string, url: string, source: ILinkReferenceSource | null): readonly GitReferencePart[] {
    return [new GitReferencePart(text, url, source?.find(url, text) ?? null)];
  }
}
