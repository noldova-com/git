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

/** A run of a text the Git view shows: plain words, or a reference it links to the reference's page. */
export class GitReferencePart {
  public readonly text: string;
  /** The address the run links to, or null for plain words. */
  public readonly url: string | null;
  /** The reference as its host reads it, null in it while the host has no look for it; null for plain words or a link no host knows. */
  public readonly reference: Signal<LinkReference | null> | null;

  public constructor(text: string, url: string | null = null, reference: Signal<LinkReference | null> | null = null) {
    this.text = text;
    this.url = url;
    this.reference = reference;
  }

  /** A text cut into its words and the references the hosts find in it, in order; of two matches that overlap, the first one written stays. */
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

  /** A text's words before and after the first time it writes what links, such as "Review " and "" around "!8"; all of it links when it doesn't write it. */
  public static around(text: string, linked: string): GitTextAround {
    const at = text.indexOf(linked);
    return at < 0 ? new GitTextAround("", text, "") : new GitTextAround(text.slice(0, at), linked, text.slice(at + linked.length));
  }

  /** A text that links as a whole to an address, such as a pull request's number to its page, as one reference. */
  public static linked(text: string, url: string, source: ILinkReferenceSource | null): readonly GitReferencePart[] {
    return [new GitReferencePart(text, url, source?.find(url, text) ?? null)];
  }
}
