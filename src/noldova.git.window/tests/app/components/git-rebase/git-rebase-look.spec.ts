/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitRebaseCheck, GitRebaseCommit, GitRebasePlan, GitRebaseStepCheck, RebaseCheckOutcome } from "@noldova/git.protocol";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitRebaseComponent } from "../../../../src/app/components/git-rebase/git-rebase.component.ts";
import { GitRebasePreviewComponent } from "../../../../src/app/components/git-rebase-preview/git-rebase-preview.component.ts";
import { GitRebaseTarget, GitRebasing } from "../../../../src/app/services/git-rebasing.ts";
import { GitViewOptions } from "../../../../src/app/services/git-view-options.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitLayout } from "../../../fixtures/git-layout.fixture.ts";

describe("GitRebaseComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();
  const onto: string = "0".repeat(40);
  const plan: GitRebasePlan = new GitRebasePlan("feature/graph", onto, "b".repeat(40), 4, [
    new GitRebaseCommit("a".repeat(40), "Read the log as a stream", null), new GitRebaseCommit("c".repeat(40), "Draw lanes on a canvas", null)
  ], ["feature/minimap"], true);
  const clean: GitRebaseStepCheck = new GitRebaseStepCheck(RebaseCheckOutcome.Clean, []);

  const resolve = (color: string): string => {
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style.color = color;
    document.body.append(probe);
    const resolved: string = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  };

  /** An element on the page with one style set, whose computed style resolves a token. */
  const probeOf = (property: string, value: string): HTMLElement => {
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style.setProperty(property, value);
    document.body.append(probe);
    onTestFinished(() => probe.remove());
    return probe;
  };

  const untilAsync = (element: HTMLElement, done: () => boolean): Promise<void> => {
    if (done())
      return Promise.resolve();
    return new Promise(resolved => {
      const observer: MutationObserver = new MutationObserver(() => {
        if (!done())
          return;
        observer.disconnect();
        resolved();
      });
      observer.observe(element, { attributes: true, characterData: true, childList: true, subtree: true });
    });
  };

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      AppearanceFixture.reset();
    }
  });

  /** The rebase document and the Rebase preview view beside it, as the window shows them. */
  interface IRendered {
    readonly fixture: ComponentFixture<GitRebaseComponent>;
    readonly document: HTMLElement;
    readonly view: HTMLElement;
  }

  /** Renders the screen in a mode, at 70rem by 40rem unless told, with the Rebase preview view at the dock's width, once the view shows the preview. */
  async function renderAsync(mode: ThemeMode, width: string = "70rem", height: string = "40rem", viewWidth: string = "22rem"): Promise<IRendered> {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.status": GitFixtures.status([], null, { fingerprint: "f1" }).toJson(), "git.rebasePlan": plan.toJson(),
      "git.rebaseCheck": new GitRebaseCheck([clean, clean]).toJson()
    });
    GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: signal(true) }]);
    onTestFinished(() => GitRebasing.targets.set(new Map()));
    GitRebasing.open(GitFixtures.folder, new GitRebaseTarget(onto, "main"));
    const fixture: ComponentFixture<GitRebaseComponent> = TestBed.createComponent(GitRebaseComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const view: ComponentFixture<GitRebasePreviewComponent> = TestBed.createComponent(GitRebasePreviewComponent);
    view.componentRef.setInput("instance", "selected");
    view.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    // TestBed takes the earlier fixtures' root elements out of the page as it creates a component, so the document goes back beside the view.
    document.body.append(element);
    const viewElement: HTMLElement = view.nativeElement;
    element.style.width = width;
    element.style.height = height;
    viewElement.style.width = viewWidth;
    viewElement.style.height = height;
    await untilAsync(viewElement, () => !Object.isNull(viewElement.querySelector(".after .onto-dot")));
    await fixture.whenStable();
    return { fixture, document: element, view: viewElement };
  }

  it.each(AppearanceFixture.modes)("rounds the steps panel as the kit's large card across the document, heads it with a toolbar button, and lays the Rebase preview view out at the dock's width with its groups spaced as drawn, in %s mode",
    async mode => {
      GitViewOptions.showsAiFeatures.set(true);
      onTestFinished(() => GitViewOptions.showsAiFeatures.set(false));
      const { document: element, view } = await renderAsync(mode);

      const find = (selector: string): HTMLElement => element.querySelector<HTMLElement>(selector) ?? element;
      const inView = (selector: string): HTMLElement => view.querySelector<HTMLElement>(selector) ?? view;
      const all = (selector: string): readonly DOMRect[] => [...view.querySelectorAll(selector)].map(t => box(t));
      const panel: DOMRect = box(find(".steps-panel"));
      expect([rem(parseFloat(getComputedStyle(find(".steps-panel")).borderTopLeftRadius)), element.querySelectorAll("aside").length, rem(panel.left - box(element).left),
        rem(box(element).right - panel.right)]).toEqual([0.5, 0, 0.25, 0.25]);
      expect(getComputedStyle(find(".title-icon")).color).toBe(resolve("var(--nol-icon-color)"));

      const tidy: DOMRect = box(find(".tidy-up"));
      const row: DOMRect = box(find(".title-row"));
      expect([rem(tidy.height), rem(row.right - tidy.right), rem(box(find(".tidy-up .nol-toolbar-button-glyph")).left - tidy.left)]).toEqual([1.5, 0, 0.375]);
      expect(rem(box(find(".head")).right - row.right)).toBe(0.75);

      const gaps = (group: string): readonly number[] => {
        const boxes: readonly DOMRect[] = all(`${group} > *`);
        return boxes.slice(1).map((t, i) => rem(t.top - (boxes[i]?.bottom ?? 0)));
      };
      expect([gaps(".now"), gaps(".after")]).toEqual([[0.25, 0.25, 0.25], [0.375, 0.125, 0.125, 0.125, 0.125]]);
      const host: DOMRect = box(view);
      expect([rem(box(inView(".now")).top - host.top), rem(box(inView(".after")).top - box(inView(".now")).bottom),
        ...[".now .caps", ".now .node", ".after .caps", ".after .node"].map(t => rem(box(inView(t)).left - host.left)), rem(host.bottom - box(inView(".pushed")).bottom)])
        .toEqual([0.75, 1, 0.75, 0.75, 0.75, 0.75, 0.75]);
      const ontoId: HTMLElement = inView(".after .onto-dot ~ .muted");
      expect([getComputedStyle(ontoId).fontFamily, view.scrollWidth <= view.clientWidth, getComputedStyle(view).backgroundColor, getComputedStyle(inView(".chip")).color,
        getComputedStyle(inView(".caps")).color]).toEqual([getComputedStyle(element).fontFamily, true, resolve("var(--nol-panel)"), resolve("var(--nol-text-strong)"),
        resolve("var(--nol-text-muted)")]);

      await page.screenshot({ element, path: `${screenshots}/git-rebase-${mode}.png` });
      await page.screenshot({ element: view, path: `${screenshots}/git-rebase-preview-${mode}.png` });
    });

  it("fits the app's narrowest window, 640 by 480 less the title bar and margins, and a 15rem Rebase preview view, with nothing clipped, outside it or overlapping, in dark mode", async () => {
    const { document: element, view } = await renderAsync(ThemeMode.Dark, "39.5rem", "27rem", "15rem");

    const steps: HTMLElement = element.querySelector<HTMLElement>(".steps") ?? element;
    const rows: readonly HTMLElement[] = [...steps.querySelectorAll<HTMLElement>(".step")];
    const chips: readonly HTMLElement[] = [...view.querySelectorAll<HTMLElement>(".chip")];

    await page.screenshot({ element, path: `${screenshots}/git-rebase-narrow-Dark.png` });
    await page.screenshot({ element: view, path: `${screenshots}/git-rebase-preview-narrow-Dark.png` });
    expect([GitLayout.problemsOf(element), GitLayout.problemsOf(view), view.scrollWidth <= view.clientWidth]).toEqual([[], [], true]);
    expect([rows.length, rows.map(t => [rem(box(t).top - box(steps).top) >= 0, rem(box(steps).bottom - box(t).bottom) >= 0])]).toEqual([2, rows.map(() => [true, true])]);
    expect(chips.filter(t => t.scrollWidth > t.clientWidth).map(t => t.textContent)).toEqual([]);
    expect(rows.map(t => [box(t.querySelector(".check-icon")).right <= box(t).right, box(t.querySelector(".check-text")).width, t.querySelector(".check-text")?.textContent]))
      .toEqual(rows.map(() => [true, 1, "Applies cleanly"]));
  });

  it.each(AppearanceFixture.modes)("keeps the steps' Check column and whole title in a 30rem middle, nothing clipped, in %s mode", async mode => {
    const { document: element } = await renderAsync(mode, "30rem", "40rem");

    const panel: DOMRect = box(element.querySelector(".steps-panel"));
    const rows: readonly HTMLElement[] = [...element.querySelectorAll<HTMLElement>(".steps .step")];
    const title: HTMLElement | null = element.querySelector<HTMLElement>(".title");

    await page.screenshot({ element, path: `${screenshots}/git-rebase-30rem-${mode}.png` });
    expect(GitLayout.problemsOf(element)).toEqual([]);
    expect([rem(panel.left - box(element).left), rem(box(element).right - panel.right)]).toEqual([0.25, 0.25]);
    expect(rows.map(t => [box(t.querySelector(".check-icon")).width > 0, box(t.querySelector(".check-icon")).right <= Math.min(box(t).right, panel.right)]))
      .toEqual(rows.map(() => [true, true]));
    expect([rows.length > 0, (title?.scrollWidth ?? 1) <= (title?.clientWidth ?? 0)]).toEqual([true, true]);
  });

  it.each(AppearanceFixture.modes)("lifts a dragged row as a menu card under the pointer, 0.5rem in from the list, a border taller than a row, tilted and shadowed as the kit's drag ghosts, in %s mode",
    async mode => {
      const { fixture, document: element } = await renderAsync(mode);
      const steps: HTMLElement = element.querySelector<HTMLElement>(".steps") ?? element;
      const rows: HTMLElement[] = [...steps.querySelectorAll<HTMLElement>(".step:not(.lift)")];
      const [first, second] = [rows[0] ?? steps, rows[1] ?? steps];
      const middle = (row: HTMLElement): number => box(row).top + box(row).height / 2;
      first.dispatchEvent(new DragEvent("dragstart", { bubbles: true, clientY: middle(first), dataTransfer: new DataTransfer() }));
      second.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, clientY: middle(second) }));
      fixture.detectChanges();
      const card: HTMLElement = steps.querySelector<HTMLElement>(".lift") ?? steps;
      const style: CSSStyleDeclaration = getComputedStyle(card);
      const words = (row: HTMLElement): string => [".id", ".message"].map(t => row.querySelector<HTMLElement>(t)?.innerText.trim()).join(" ");
      await untilAsync(card, () => card.querySelector(".check-text")?.textContent === "Dropped here: clean");
      const check: HTMLElement = card.querySelector<HTMLElement>(".check-text") ?? card;

      expect([words(card), card.getAttribute("aria-hidden"), card.inert, getComputedStyle(first).opacity]).toEqual([words(first), "true", true, "0.35"]);
      expect([check.scrollWidth <= check.clientWidth, box(check).right <= box(card).right, getComputedStyle(card.querySelector(".check-icon") ?? card).color])
        .toEqual([true, true, resolve("var(--nol-status-ok)")]);
      expect([card.offsetTop - second.offsetTop, rem(card.offsetLeft), rem(steps.clientWidth - card.offsetLeft - card.offsetWidth), card.offsetHeight - first.offsetHeight])
        .toEqual([0, 0.5, 0.5, 1]);
      expect([style.backgroundColor, style.borderTopColor, style.borderTopWidth, rem(parseFloat(style.borderTopLeftRadius)), style.boxShadow, style.color, style.pointerEvents])
        .toEqual([resolve("var(--nol-menu)"), resolve("var(--nol-menu-border)"), "1px", 0.375, getComputedStyle(probeOf("box-shadow", "var(--nol-shadow-large)")).boxShadow,
          resolve("var(--nol-menu-text)"), "none"]);
      const matrix: DOMMatrix = new DOMMatrix(style.transform);
      expect([Math.round(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI * 100) / 100, rem(matrix.e), rem(matrix.f)]).toEqual([-0.4, 0.75, 0.125]);

      await page.screenshot({ element: steps, path: `${screenshots}/git-rebase-drag-${mode}.png` });
      first.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
      fixture.detectChanges();
      expect(steps.querySelectorAll(".lift")).toHaveLength(0);
    });

  it.each(AppearanceFixture.modes)("closes the title row up to the title, with nothing after it, while the app leaves AI features off, in %s mode", async mode => {
    const { document: element } = await renderAsync(mode);
    const row: HTMLElement = element.querySelector<HTMLElement>(".title-row") ?? element;
    const icon: DOMRect = box(row.querySelector(".title-icon"));
    const title: DOMRect = box(row.querySelector(".title"));

    expect([element.querySelectorAll(".tidy-up").length, row.children.length, rem(title.left - icon.right), rem(box(row).right - title.right),
      rem(box(row).height - Math.max(icon.height, title.height))]).toEqual([0, 2, 0.5, 0, 0]);
    await page.screenshot({ element, path: `${screenshots}/git-rebase-no-ai-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("says how to fill the Rebase preview view while no rebase document is open, 0.75rem in from its edges in muted text, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    GitFixtures.setUp(new FakeWindowPartContext(), []);
    const view: ComponentFixture<GitRebasePreviewComponent> = TestBed.createComponent(GitRebasePreviewComponent);
    view.componentRef.setInput("instance", "selected");
    view.autoDetectChanges();
    const element: HTMLElement = view.nativeElement;
    element.style.width = "15rem";
    element.style.height = "20rem";
    const empty: HTMLElement = element.querySelector<HTMLElement>(".empty-view") ?? element;

    expect([empty.textContent?.trim(), rem(box(empty).left - box(element).left), rem(box(empty).top - box(element).top), rem(box(element).right - box(empty).right),
      getComputedStyle(empty).color, getComputedStyle(element).backgroundColor])
      .toEqual(["Open an interactive rebase to preview it.", 0.75, 0.75, 0.75, resolve("var(--nol-text-muted)"), resolve("var(--nol-panel)")]);
    await page.screenshot({ element, path: `${screenshots}/git-rebase-preview-empty-${mode}.png` });
  });
});
