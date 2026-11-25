/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { MergeEditorComponent } from "@noldova/editor.angular";
import { ConflictKind, FileState, GitConflict, GitMarkerCheck, GitOperation, OperationKind } from "@noldova/git.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitConflictDetailComponent } from "../../../../src/app/components/git-conflict-detail/git-conflict-detail.component.ts";
import { GitConflictsComponent } from "../../../../src/app/components/git-conflicts/git-conflicts.component.ts";
import { GitResolving } from "../../../../src/app/services/git-resolving.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";

/** The conflicts document and the Conflict view beside it. */
class ConflictScreens {
  public readonly document: HTMLElement;
  public readonly view: HTMLElement;

  public constructor(document: HTMLElement, view: HTMLElement) {
    this.document = document;
    this.view = view;
  }
}

describe("GitConflictDetailComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();
  const based: string = "<<<<<<< main\nours\n||||||| base\nconst base = 0; // a base line long enough to scroll in a narrow view\n=======\ntheirs\n>>>>>>> feature\n";

  const resolve = (color: string): string => {
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style.color = color;
    document.body.append(probe);
    const resolved: string = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  };

  const untilAsync = (elements: readonly HTMLElement[], done: () => boolean): Promise<void> => {
    if (done())
      return Promise.resolve();
    return new Promise(resolved => {
      const observer: MutationObserver = new MutationObserver(() => {
        if (!done())
          return;
        observer.disconnect();
        resolved();
      });
      for (const element of elements)
        observer.observe(element, { attributes: true, characterData: true, childList: true, subtree: true });
    });
  };

  /** The conflicts document and the Conflict view beside it, with a merge's conflicted file open and its conflict active. */
  const renderAsync = async (viewWidth: string): Promise<ConflictScreens> => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([GitFixtures.entry("src/a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)], null,
        { operation: new GitOperation(OperationKind.Merge, "feature", "Merge branch 'feature'"), fingerprint: "f1" }).toJson(),
      "git.conflict": new GitConflict("src/a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours\n", "theirs\n", based, "main", "feature", null, null, false, false)
        .toJson(),
      "git.markerCheck": new GitMarkerCheck(["src/x.ts", "src/y.ts"]).toJson()
    });
    GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: signal(true) }]);
    onTestFinished(() => GitResolving.opened.set(new Map()));
    const fixture: ComponentFixture<GitConflictsComponent> = TestBed.createComponent(GitConflictsComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const view: ComponentFixture<GitConflictDetailComponent> = TestBed.createComponent(GitConflictDetailComponent);
    view.componentRef.setInput("instance", "selected");
    view.autoDetectChanges();
    const documentElement: HTMLElement = fixture.nativeElement;
    // TestBed takes the earlier fixtures' root elements out of the page as it creates a component, so the document goes back beside the view.
    document.body.append(documentElement);
    const viewElement: HTMLElement = view.nativeElement;
    documentElement.style.width = "70rem";
    documentElement.style.height = "30rem";
    viewElement.style.width = viewWidth;
    viewElement.style.height = "30rem";
    await untilAsync([documentElement, viewElement], () => !Object.isNull(fixture.debugElement.query(By.directive(MergeEditorComponent))));
    fixture.debugElement.query(By.directive(MergeEditorComponent)).injector.get(MergeEditorComponent).nextConflict();
    await untilAsync([viewElement], () => !Object.isNull(viewElement.querySelector(".base-text .nol-code-text-line")) && !Object.isNull(viewElement.querySelector(".markers")));
    await fixture.whenStable();
    return new ConflictScreens(documentElement, viewElement);
  };

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      AppearanceFixture.reset();
    }
  });

  it.each(AppearanceFixture.modes)("gives the merge the document's width and lays the Conflict view out at the dock's width with its text on one edge and its note at the foot, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const { document: screen, view } = await renderAsync("21rem");
      const find = (selector: string): HTMLElement => view.querySelector<HTMLElement>(selector) ?? view;
      const host: DOMRect = box(view);
      const starts: readonly number[] = [".detail-title", ".base .checklist-title", ".base-text", ".checklist .checklist-title", ".markers", ".detail-note"]
        .map(t => rem(box(find(t)).left - host.left));

      expect([screen.querySelectorAll("aside").length, rem(box(screen).right - box(screen.querySelector(".sides")).right)]).toEqual([0, 0.25]);
      expect(starts).toEqual([0.75, 0.75, 0.75, 0.75, 0.75, 0.75]);
      expect([rem(box(find(".detail-title")).top - host.top), rem(host.bottom - box(find(".detail-note")).bottom), rem(host.right - box(find(".base-text")).right)])
        .toEqual([0.75, 0.75, 0.75]);
      expect([view.scrollWidth <= view.clientWidth, getComputedStyle(view).backgroundColor, getComputedStyle(find(".detail-title")).color,
        getComputedStyle(find(".base-text")).borderTopColor, getComputedStyle(find(".markers .file-icon")).color])
        .toEqual([true, "rgba(0, 0, 0, 0)", resolve("var(--nol-text-strong)"), resolve("var(--nol-card-border)"), resolve("var(--nol-warning)")]);
      await page.screenshot({ element: view, path: `${screenshots}/git-conflict-detail-${mode}.png` });
      await page.screenshot({ element: screen, path: `${screenshots}/git-conflicts-without-detail-${mode}.png` });
    });

  it.each(AppearanceFixture.modes)("keeps a narrow Conflict view inside its width, scrolling the base's long line in its own box and wrapping the check, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const { view } = await renderAsync("13rem");
    const base: HTMLElement = view.querySelector<HTMLElement>(".base-text") ?? view;
    const check: HTMLElement = view.querySelector<HTMLElement>(".markers .check-text") ?? view;

    expect([view.scrollWidth <= view.clientWidth, base.scrollWidth > base.clientWidth, rem(box(view).right - box(base).right), rem(box(view).right - box(check).right) >= 0.749,
      box(check).height > parseFloat(getComputedStyle(check).lineHeight)]).toEqual([true, true, 0.75, true, true]);
    await page.screenshot({ element: view, path: `${screenshots}/git-conflict-detail-narrow-${mode}.png` });
  });
});
