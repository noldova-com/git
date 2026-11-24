/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injector, signal } from "@angular/core";
import type { ILinkReferenceSource } from "@noldova/ui.components.angular";
import { describe, expect, it } from "vitest";

import type { IGitLinkReferences } from "../../../src/app/interfaces/i-git-link-references.ts";
import { GitLinkReferenceSet } from "../../../src/app/services/git-link-reference-set.ts";
import { GitLinkReferences } from "../../../src/app/services/git-link-references.ts";

describe("GitLinkReferences", () => {
  const sourceOf = (): ILinkReferenceSource => ({ find: () => null });

  it("gives none with no host, the one host's own source, and a set once two hosts know the folder, until each withdraws", () => {
    const [first, second] = [sourceOf(), sourceOf()];
    const firstHost: IGitLinkReferences = { referencesFor: t => t === "/repository" ? first : null };
    const before = GitLinkReferences.of("/repository");
    const withdrawFirst = GitLinkReferences.provide(firstHost);
    const withdrawSecond = GitLinkReferences.provide({ referencesFor: () => second });

    const both = GitLinkReferences.of("/repository");
    const elsewhere = GitLinkReferences.of("/other");
    withdrawSecond();
    const one = GitLinkReferences.of("/repository");
    withdrawFirst();

    expect([before, both instanceof GitLinkReferenceSet, elsewhere, one, GitLinkReferences.of("/repository")]).toEqual([null, true, second, first, null]);
  });

  it("lets the first host that opens a link of its own take it with the window's injector, asks none without a way to, and leaves the rest to the window", () => {
    const injector = Injector.create({ providers: [] });
    const asked: string[] = [];
    const injectors: Injector[] = [];
    const withdrawPlain = GitLinkReferences.provide({ referencesFor: () => null });
    const withdrawOwn = GitLinkReferences.provide({
      referencesFor: () => null,
      opens: (folder, url, given) => {
        asked.push(`${folder} ${url}`);
        injectors.push(given);
        return url.startsWith("example-host:");
      }
    });

    const opened = [GitLinkReferences.opens("/repository", "example-host:branch?id=42", injector),
      GitLinkReferences.opens("/repository", "https://example.com/", injector)];
    withdrawOwn();
    withdrawPlain();

    expect([opened, asked, GitLinkReferences.opens("/repository", "example-host:branch?id=42", injector)]).toEqual([[true, false],
      ["/repository example-host:branch?id=42", "/repository https://example.com/"], false]);
    expect(injectors.every(t => t === injector)).toBe(true);
  });

  it("answers again when a host's source changes, for a view that reads it in a computed signal", () => {
    const home = signal<ILinkReferenceSource | null>(null);
    const withdraw = GitLinkReferences.provide({ referencesFor: () => home() });
    const before = GitLinkReferences.of("/repository");
    const source = sourceOf();
    home.set(source);
    const after = GitLinkReferences.of("/repository");
    withdraw();

    expect([before, after]).toEqual([null, source]);
  });
});
