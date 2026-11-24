/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ILinkReferenceSource, LinkReference, LinkReferenceImage, LinkReferenceMatch } from "@noldova/ui.components.angular";
import { describe, expect, it } from "vitest";

import { GitReferencePart } from "../../../src/app/models/git-reference-part.ts";

const ISSUE: string = "https://dev.azure.com/fabrikam/_workitems/edit/12";
const OTHER: string = "https://dev.azure.com/fabrikam/_workitems/edit/5";
const issue = signal<LinkReference | null>(new LinkReference("Bug 12", "Bug", new LinkReferenceImage("data:,")));

/** A source that finds the matches it's given and knows only the issue's address. */
function sourceOf(...matches: readonly LinkReferenceMatch[]): ILinkReferenceSource {
  return { find: t => t === ISSUE ? issue : null, findText: () => matches };
}

function shown(parts: readonly GitReferencePart[]): readonly (readonly [string, string | null, boolean])[] {
  return parts.map(t => [t.text, t.url, t.reference === issue]);
}

describe("GitReferencePart", () => {
  it("cuts a text into its words and the references a source finds, in the order they're written, each with the look the source has for it", () => {
    const parts = GitReferencePart.of("Fixes AB#12 and #5", sourceOf(new LinkReferenceMatch(16, 2, OTHER), new LinkReferenceMatch(6, 5, ISSUE)));

    expect(shown(parts)).toEqual([["Fixes ", null, false], ["AB#12", ISSUE, true], [" and ", null, false], ["#5", OTHER, false]]);
    expect(parts[3]?.reference).toBeNull();
  });

  it("keeps the first of two matches that overlap, and a text that starts and ends with a reference has no empty words", () => {
    const parts = GitReferencePart.of("AB#12", sourceOf(new LinkReferenceMatch(0, 5, ISSUE), new LinkReferenceMatch(2, 3, OTHER)));

    expect(shown(parts)).toEqual([["AB#12", ISSUE, true]]);
  });

  it("keeps a text as plain words without a source, from a source that finds nothing or one that doesn't look in text, and an empty text as one run", () => {
    const texts = [GitReferencePart.of("Fixes #5", null), GitReferencePart.of("Fixes #5", sourceOf()), GitReferencePart.of("Fixes #5", { find: () => issue }),
      GitReferencePart.of("", sourceOf())];

    expect(texts.map(shown)).toEqual([[["Fixes #5", null, false]], [["Fixes #5", null, false]], [["Fixes #5", null, false]], [["", null, false]]]);
  });

  it("finds the words before and after what links in a text, and links all of a text that doesn't write it", () => {
    expect([GitReferencePart.around("Review !8", "!8"), GitReferencePart.around("!8 open · on !7", "!8"), GitReferencePart.around("No pull request", "!8")])
      .toEqual([["Review ", "!8", ""], ["", "!8", " open · on !7"], ["", "No pull request", ""]]);
  });

  it("links a whole text to an address as one reference, with the source's look for it, or none without a source", () => {
    expect([shown(GitReferencePart.linked("!12", ISSUE, sourceOf())), shown(GitReferencePart.linked("!12", ISSUE, null))])
      .toEqual([[["!12", ISSUE, true]], [["!12", ISSUE, false]]]);
  });
});
