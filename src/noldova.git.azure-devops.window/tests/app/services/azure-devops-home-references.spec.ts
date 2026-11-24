/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal } from "@angular/core";
import { WorkItemQuery } from "@noldova/git.hosting.protocol";
import type { ILinkReferenceSource, LinkReference } from "@noldova/ui.components.angular";
import { describe, expect, it } from "vitest";

import { AzureDevOpsReferenceLink } from "../../../src/app/models/azure-devops-reference-link.ts";
import { AzureDevOpsHomeReferences } from "../../../src/app/services/azure-devops-home-references.ts";
import { AzureDevOpsReferenceLooks } from "../../../src/app/services/azure-devops-reference-looks.ts";

class RecordedSource implements ILinkReferenceSource {
  public readonly asked: (readonly [string, string])[] = [];
  public readonly answer: Signal<LinkReference | null>;

  public constructor(answer: Signal<LinkReference | null>) {
    this.answer = answer;
  }

  public find(url: string, text: string): Signal<LinkReference | null> | null {
    this.asked.push([url, text]);
    return url.includes("_workitems") ? this.answer : null;
  }
}

const pending: LinkReference = AzureDevOpsReferenceLooks.pendingOf(
  new AzureDevOpsReferenceLink(new WorkItemQuery("git-azure-devops", "fabrikam", 42), "fabrikam#42"));

describe("AzureDevOpsHomeReferences", () => {
  it("asks the source it wraps for a link's item and answers what it answers", () => {
    const source = new RecordedSource(signal(pending));
    const references = new AzureDevOpsHomeReferences(source, "fabrikam");

    const found = [references.find("https://dev.azure.com/fabrikam/web/_workitems/edit/42", "#42"), references.find("https://example.com/", "home")];

    expect([found[0], found[1], source.asked]).toEqual([source.answer, null,
      [["https://dev.azure.com/fabrikam/web/_workitems/edit/42", "#42"], ["https://example.com/", "home"]]]);
  });

  it("finds #N and AB#N in a commit's message as work items of its home organization, without asking the source", () => {
    const source = new RecordedSource(signal(null));
    const text = "Fixes AB#42 and #7.";

    const matches = new AzureDevOpsHomeReferences(source, "contoso").findText(text);

    expect([matches.map(t => [text.slice(t.start, t.start + t.length), t.url]), source.asked]).toEqual([[
      ["AB#42", "https://dev.azure.com/contoso/_workitems/edit/42"],
      ["#7", "https://dev.azure.com/contoso/_workitems/edit/7"]], []]);
  });
});
