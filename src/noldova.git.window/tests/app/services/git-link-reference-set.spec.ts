/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import "@noldova/context.core";
import { type ILinkReferenceSource, LinkReference, LinkReferenceImage, LinkReferenceMatch } from "@noldova/ui.components.angular";
import { describe, expect, it } from "vitest";

import { GitLinkReferenceSet } from "../../../src/app/services/git-link-reference-set.ts";

describe("GitLinkReferenceSet", () => {
  const issue = signal<LinkReference | null>(new LinkReference("example-owner/example-repository#5", "Issue", new LinkReferenceImage("data:,")));
  const gitHub: ILinkReferenceSource = {
    find: t => t.startsWith("https://github.com/") ? issue : null,
    findText: () => [new LinkReferenceMatch(10, 6, "https://github.com/a/b/issues/5"), new LinkReferenceMatch(30, 4, "https://github.com/a/b/issues/6")]
  };
  const other: ILinkReferenceSource = {
    find: t => t.startsWith("https://") ? signal(null) : null,
    findText: () => [new LinkReferenceMatch(0, 4, "https://host.example/1"), new LinkReferenceMatch(12, 6, "https://host.example/2"),
      new LinkReferenceMatch(16, 8, "https://host.example/3")]
  };
  const plain: ILinkReferenceSource = { find: () => null };

  it("draws a link with the first source that knows it, and none when no source does", () => {
    const set = new GitLinkReferenceSet([gitHub, other, plain]);

    expect([set.find("https://github.com/a/b/issues/5", "#5"), Object.isNull(set.find("https://host.example/1", "#1")), set.find("docs/readme.md", "readme")])
      .toEqual([issue, false, null]);
  });

  it("finds each source's matches in the text's order, dropping a match that overlaps an earlier one, and none from a source that finds no text", () => {
    const set = new GitLinkReferenceSet([gitHub, plain, other]);

    expect(set.findText("text").map(t => [t.start, t.length, t.url])).toEqual([
      [0, 4, "https://host.example/1"], [10, 6, "https://github.com/a/b/issues/5"], [16, 8, "https://host.example/3"], [30, 4, "https://github.com/a/b/issues/6"]
    ]);
  });
});
