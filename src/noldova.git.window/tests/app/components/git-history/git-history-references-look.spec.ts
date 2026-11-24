/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitCommit, GitGraph, GitGraphCommit } from "@noldova/git.protocol";
import { DefaultTheme, LinkReference, LinkReferenceColor, LinkReferenceImage, LinkReferenceMatch, LinkReferenceState, LinkReferenceTone,
  LinkReferenceWorkItemState } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitHistoryComponent } from "../../../../src/app/components/git-history/git-history.component.ts";
import { GitLinkReferences } from "../../../../src/app/services/git-link-references.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";

describe("GitHistoryComponent references in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const issue: string = "https://dev.azure.com/fabrikam/_workitems/edit/12";
  const other: string = "https://dev.azure.com/fabrikam/_workitems/edit/5";
  const icon: string = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='6'/%3E%3C/svg%3E";
  const reference: LinkReference = new LinkReference("Bug 12", "Bug", new LinkReferenceImage(icon), {
    state: new LinkReferenceState("Bug", new LinkReferenceColor("#CC293D", "#FBE7E9"), new LinkReferenceColor("#F06B7A", "#3A1D21")),
    workItemState: new LinkReferenceWorkItemState("Active", new LinkReferenceTone("#007ACC", "#3794FF")),
    title: "Fix the login",
    itemHref: issue
  });
  const graph: GitGraph = new GitGraph([
    new GitGraphCommit(new GitCommit("a".repeat(40), ["b".repeat(40)], "Sample Author", "2026-11-06T17:30:00Z", "Fixes AB#12 and #5"), "author@example.com", []),
    new GitGraphCommit(new GitCommit("b".repeat(40), [], "Sample Author", "2026-11-05T17:30:00Z", "First"), "author@example.com", [])
  ], false);
  const box = (element: Element | null | undefined): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();
  const until = async (condition: () => boolean): Promise<void> => {
    for (let tries = 0; !condition() && tries < 200; tries++)
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  };

  /** A colour as the document computes it, for a property the probe sets to it. */
  const resolve = (property: "color" | "textDecorationColor", color: string): string => {
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style[property] = color;
    document.body.append(probe);
    const resolved: string = getComputedStyle(probe)[property];
    probe.remove();
    return resolved;
  };

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      AppearanceFixture.reset();
    }
  });

  it.each(AppearanceFixture.modes)("draws a reference as the kit's chip in the link colour, underlined at 45% of it 0.2em below the text, with its state after it,"
    + " inside its row's line, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    onTestFinished(GitLinkReferences.provide({
      referencesFor: folder => folder === GitFixtures.folder ? {
        find: t => t === issue ? signal(reference) : null,
        findText: t => [new LinkReferenceMatch(t.indexOf("AB#12"), 5, issue), new LinkReferenceMatch(t.indexOf("#5"), 2, other)].filter(u => u.start >= 0)
      } : null,
      opens: () => false
    }));
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.graph": graph.toJson(), "git.status": GitFixtures.status().toJson() });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.style.width = "60rem";
    element.style.height = "20rem";
    await until(() => element.querySelector("a[nol-link-reference-chip]") !== null);
    await fixture.whenStable();
    const [row, plainRow] = [...element.querySelectorAll<HTMLElement>("[role=option]")];
    const chip: HTMLElement = row?.querySelector<HTMLElement>("a[nol-link-reference-chip]") ?? element;
    const plain: HTMLElement = row?.querySelector<HTMLElement>(`a[href="${other}"]`) ?? element;
    const state: HTMLElement = row?.querySelector<HTMLElement>("nol-link-reference-work-item-state") ?? element;
    const style: CSSStyleDeclaration = getComputedStyle(chip);

    expect([style.color, style.textDecorationLine, style.textDecorationColor, getComputedStyle(plain).color, getComputedStyle(plain).textDecorationLine])
      .toEqual([resolve("color", "var(--nol-link)"), "underline", resolve("textDecorationColor", "color-mix(in srgb, var(--nol-link) 45%, transparent)"),
        resolve("color", "var(--nol-link)"), "none"]);
    AppearanceFixture.expectPixels(Number.parseFloat(style.textUnderlineOffset), Number.parseFloat(style.fontSize) * 0.2);
    expect(box(row).height).toBeGreaterThan(0);
    expect(box(row).top).toBeGreaterThanOrEqual(box(element.querySelector("cdk-virtual-scroll-viewport")).top);
    expect(box(row).bottom).toBeLessThanOrEqual(box(element.querySelector("cdk-virtual-scroll-viewport")).bottom);
    expect(box(state).left).toBeGreaterThan(box(chip).right);
    expect(box(row).height).toBe(box(plainRow).height);
    expect([box(chip).top >= box(row).top, box(chip).bottom <= box(row).bottom]).toEqual([true, true]);
    await page.screenshot({ element, path: `${screenshots}/git-history-reference-chip-${mode}.png` });
  });
});
