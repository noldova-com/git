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

import { GitHubHomeReferences } from "../../../src/app/services/github-home-references.ts";

describe("GitHubHomeReferences", () => {
  const issue: string = "https://github.com/octocat/hello-world/issues/1";
  const look: LinkReference = new LinkReference("octocat/hello-world#1", "Issue", new LinkReferenceImage("data:,"));
  const finds: string[] = [];
  const source: ILinkReferenceSource = {
    find: (url, text) => {
      finds.push(`${url} ${text}`);
      return url === issue ? signal(look) : null;
    },
    findText: () => [new LinkReferenceMatch(0, 1, "https://example.com/")]
  };
  const references: GitHubHomeReferences = new GitHubHomeReferences(source, "noldova-com/teamrun");

  it("asks the source for an address's look, and has none where the source has none", () => {
    const found = references.find(issue, "#1");
    const missing = references.find("https://github.com/octocat/hello-world", "hello-world");

    expect([found?.(), missing, finds]).toEqual([look, null, [`${issue} #1`, "https://github.com/octocat/hello-world hello-world"]]);
  });

  it("finds #N in a text as the home repository's item, and owner/repo#N as its own, not the source's matches", () => {
    const text: string = "Fixed in #12, see octocat/hello-world#1.";

    expect(references.findText(text).map(t => [text.slice(t.start, t.start + t.length), t.url])).toEqual([
      ["#12", "https://github.com/noldova-com/teamrun/issues/12"],
      ["octocat/hello-world#1", "https://github.com/octocat/hello-world/issues/1"]
    ]);
  });

  it("finds nothing in a text without references", () => {
    expect(references.findText("Nothing to link here.")).toEqual([]);
  });
});
