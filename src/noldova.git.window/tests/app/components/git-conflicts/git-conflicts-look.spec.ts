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
import { ConflictKind, FileState, GitConflict, GitMarkerCheck, GitOperation, OperationKind } from "@noldova/git.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitConflictsComponent } from "../../../../src/app/components/git-conflicts/git-conflicts.component.ts";
import { GitResolving } from "../../../../src/app/services/git-resolving.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitLayout } from "../../../fixtures/git-layout.fixture.ts";

describe("GitConflictsComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();

  const resolve = (color: string): string => {
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style.color = color;
    document.body.append(probe);
    const resolved: string = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
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

  it.each(AppearanceFixture.modes)("rounds its cards as the kit's large cards, draws a clean file's icon in the icon colour, takes a side with a toolbar button, and marks abort and commit with icons, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      GitFixtures.answerWith(context, {
        ...GitFixtures.watching,
        "git.status": GitFixtures.status([
          GitFixtures.entry("src/a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.DeletedByThem),
          GitFixtures.entry("src/b.ts", FileState.Modified, FileState.Unmodified)
        ], null, { operation: new GitOperation(OperationKind.Merge, "feature", "Merge branch 'feature'"), fingerprint: "f1" }).toJson(),
        "git.conflict": new GitConflict("src/a.ts", ConflictKind.DeletedByThem, OperationKind.Merge, "b\n", "ours\n", null, null, "main", "feature", null, null, false, false).toJson()
      });
      GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: signal(true) }]);
      onTestFinished(() => GitResolving.opened.set(new Map()));
      GitResolving.open(GitFixtures.folder, "src/a.ts");
      const fixture: ComponentFixture<GitConflictsComponent> = TestBed.createComponent(GitConflictsComponent);
      fixture.componentRef.setInput("instance", GitFixtures.folder);
      fixture.autoDetectChanges();
      const element: HTMLElement = fixture.nativeElement;
      element.style.width = "60rem";
      element.style.height = "30rem";
      await untilAsync(element, () => !Object.isNull(element.querySelector(".take-ours")));
      await fixture.whenStable();

      const find = (selector: string): HTMLElement => element.querySelector<HTMLElement>(selector) ?? element;
      expect([".operation", ".files", ".pane.ours", ".pane.theirs"].map(t => rem(parseFloat(getComputedStyle(find(t)).borderTopLeftRadius))))
        .toEqual([0.5, 0.5, 0.5, 0.5]);
      expect([getComputedStyle(find(".file.clean .file-icon")).color, getComputedStyle(find(".file.conflicted .file-icon")).color])
        .toEqual([resolve("var(--nol-icon-color)"), resolve("var(--nol-warning)")]);

      const marks = (button: HTMLElement): readonly (string | number | boolean | null | undefined)[] => {
        const icon: Element | null = button.querySelector("[nolButtonIcon]");
        const middle = (rect: DOMRect): number => rect.top + rect.height / 2;
        return [icon?.textContent, rem(box(icon).width), Math.abs(middle(box(icon)) - middle(box(button))) < 1];
      };
      expect([marks(find(".abort")), marks(find(".continue"))]).toEqual([["close", 1, true], ["check", 1, true]]);

      const head: HTMLElement = find(".ours .pane-head");
      const take: DOMRect = box(find(".take-ours"));
      const headBox: DOMRect = box(head);
      const label: DOMRect = box(find(".take-ours .nol-toolbar-button-label"));
      expect([rem(take.height), rem(headBox.right - take.right), rem(label.left - take.left)]).toEqual([1.5, 0.75, 0.375]);
      expect(rem(take.top - headBox.top)).toBe(rem(headBox.bottom - head.clientTop - parseFloat(getComputedStyle(head).borderBottomWidth) - take.bottom));

      await page.screenshot({ element, path: `${screenshots}/git-conflicts-${mode}.png` });
    });
  it.each(AppearanceFixture.modes)("lays the merge editor's Ours and Theirs side by side over the result as the frame's cards, a quarter rem apart, each under its 2rem head, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      const merged: string = "<<<<<<< main\nours 1\n=======\ntheirs 1\n>>>>>>> feature\nkept\n<<<<<<< main\nours 2\n=======\ntheirs 2\n>>>>>>> feature\n";
      GitFixtures.answerWith(context, {
        ...GitFixtures.watching,
        "git.status": GitFixtures.status([
          GitFixtures.entry("src/a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)
        ], null, { operation: new GitOperation(OperationKind.Merge, "feature", "Merge branch 'feature'"), fingerprint: "f1" }).toJson(),
        "git.conflict": new GitConflict("src/a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours\n", "theirs\n", merged, "main", "feature", null, null, false, false).toJson(),
        "git.markerCheck": new GitMarkerCheck([]).toJson()
      });
      GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: signal(true) }]);
      onTestFinished(() => GitResolving.opened.set(new Map()));
      GitResolving.open(GitFixtures.folder, "src/a.ts");
      const fixture: ComponentFixture<GitConflictsComponent> = TestBed.createComponent(GitConflictsComponent);
      fixture.componentRef.setInput("instance", GitFixtures.folder);
      fixture.autoDetectChanges();
      const element: HTMLElement = fixture.nativeElement;
      element.style.width = "80rem";
      element.style.height = "40rem";
      await untilAsync(element, () => !Object.isNull(element.querySelector(".nol-merge-editor-output .pane-head")));
      await fixture.whenStable();

      const find = (selector: string): HTMLElement => element.querySelector<HTMLElement>(selector) ?? element;
      const cards: readonly HTMLElement[] = [".nol-merge-editor-side:first-child", ".nol-merge-editor-side:last-child", ".nol-merge-editor-output"].map(find);
      const ours: DOMRect = box(find(".nol-merge-editor-side:first-child"));
      const theirs: DOMRect = box(find(".nol-merge-editor-side:last-child"));
      const result: DOMRect = box(find(".nol-merge-editor-output"));
      expect([rem(theirs.left - ours.right), rem(result.top - ours.bottom), rem(result.top - theirs.bottom), rem(result.left - ours.left), rem(result.right - theirs.right)])
        .toEqual([0.25, 0.25, 0.25, 0, 0]);
      expect(cards.map(card => [rem(parseFloat(getComputedStyle(card).borderTopLeftRadius)), getComputedStyle(card).backgroundColor]))
        .toEqual(cards.map(() => [0.5, resolve("var(--nol-panel)")]));

      const heads: readonly (readonly number[])[] = cards.map(card => {
        const head: HTMLElement = card.querySelector<HTMLElement>(":scope > .pane-head") ?? card;
        const last: DOMRect = box(head.lastElementChild);
        return [rem(box(head).top - box(card).top - card.clientTop), rem(box(head).height), rem(box(head).right - last.right), rem(box(head.firstElementChild).left - box(head).left)];
      });
      expect(heads).toEqual([[0, 2, 0.75, 0.75], [0, 2, 0.75, 0.75], [0, 2, 0.75, 0.75]]);
      expect([getComputedStyle(find(".pane-head.ours .bar")).backgroundColor, getComputedStyle(find(".pane-head.theirs .bar")).backgroundColor])
        .toEqual([resolve("var(--nol-author-3)"), resolve("var(--nol-author-5)")]);
      const next: DOMRect = box(find(".next"));
      const label: DOMRect = box(find(".next .nol-toolbar-button-label"));
      expect([rem(next.height), label.width > 0, element.querySelector(".nol-merge-editor-bar")]).toEqual([1.5, true, null]);

      find(".show-base").click();
      await untilAsync(element, () => !Object.isNull(element.querySelector(".nol-merge-editor-base > .pane-head")));
      await fixture.whenStable();
      const columns: readonly DOMRect[] = [...element.querySelectorAll(".nol-merge-editor-side")].map(box);
      const baseCard: HTMLElement = find(".nol-merge-editor-base");
      const baseHead: DOMRect = box(find(".nol-merge-editor-base > .pane-head"));
      expect(columns.slice(1).map((t, i) => rem(t.left - (columns[i]?.right ?? 0)))).toEqual([0.25, 0.25]);
      expect([rem(baseHead.top - box(baseCard).top - baseCard.clientTop), rem(baseHead.height), rem(box(find(".nol-merge-editor-base > .pane-head .pane-icon")).left - baseHead.left)])
        .toEqual([0, 2, 0.75]);
      expect(getComputedStyle(find(".show-base")).backgroundColor).toBe(resolve("var(--nol-toolbar-hover)"));

      await page.screenshot({ element, path: `${screenshots}/git-conflicts-base-${mode}.png` });

      await page.screenshot({ element, path: `${screenshots}/git-conflicts-merge-${mode}.png` });
    });

  it.each(AppearanceFixture.modes)("fits the app's narrowest window, 640 by 480 less the title bar and margins, with nothing clipped, outside it or overlapping, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const merged: string = "<<<<<<< main\nours 1\n=======\ntheirs 1\n>>>>>>> feature\nkept\n";
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([
        GitFixtures.entry("src/app/app-adapter.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified),
        GitFixtures.entry("src/b.ts", FileState.Modified, FileState.Unmodified)
      ], null, { operation: new GitOperation(OperationKind.Merge, "feature", "Merge branch 'feature'"), fingerprint: "f1" }).toJson(),
      "git.conflict": new GitConflict("src/app/app-adapter.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours\n", "theirs\n", merged, "main", "feature",
        null, null, false, false).toJson(),
      "git.markerCheck": new GitMarkerCheck([]).toJson()
    });
    GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: signal(true) }]);
    onTestFinished(() => GitResolving.opened.set(new Map()));
    GitResolving.open(GitFixtures.folder, "src/app/app-adapter.ts");
    const fixture: ComponentFixture<GitConflictsComponent> = TestBed.createComponent(GitConflictsComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.style.width = "39.5rem";
    element.style.height = "27rem";
    await untilAsync(element, () => !Object.isNull(element.querySelector(".nol-merge-editor-output .pane-head")));
    await fixture.whenStable();

    await page.screenshot({ element, path: `${screenshots}/git-conflicts-narrow-${mode}.png` });
    expect(GitLayout.problemsOf(element).filter(t => !t.startsWith("scrolls sideways: div.nol-code-editor-scroller "))).toEqual([]);
  });

  it.each(AppearanceFixture.modes)("keeps the banner's buttons whole under its text and each side's short commit id after its cut branch name in a 30rem middle, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      const merged: string = "<<<<<<< main\nours 1\n=======\ntheirs 1\n>>>>>>> fix/rename-detection\nkept\n";
      GitFixtures.answerWith(context, {
        ...GitFixtures.watching,
        "git.status": GitFixtures.status([GitFixtures.entry("src/app/app-adapter.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)], null,
          { operation: new GitOperation(OperationKind.Merge, "fix/rename-detection", "Merge branch 'fix/rename-detection'"), fingerprint: "f1" }).toJson(),
        "git.conflict": new GitConflict("src/app/app-adapter.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "ours\n", "theirs\n", merged, "main",
          "fix/rename-detection", "3b9f001".padEnd(40, "0"), "e07a3c2".padEnd(40, "0"), false, false).toJson(),
        "git.markerCheck": new GitMarkerCheck([]).toJson()
      });
      GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: signal(true) }]);
      onTestFinished(() => GitResolving.opened.set(new Map()));
      GitResolving.open(GitFixtures.folder, "src/app/app-adapter.ts");
      const fixture: ComponentFixture<GitConflictsComponent> = TestBed.createComponent(GitConflictsComponent);
      fixture.componentRef.setInput("instance", GitFixtures.folder);
      fixture.autoDetectChanges();
      const element: HTMLElement = fixture.nativeElement;
      element.style.width = "30rem";
      element.style.height = "40rem";
      await untilAsync(element, () => !Object.isNull(element.querySelector(".nol-merge-editor-output .pane-head")));
      await fixture.whenStable();
      const banner: DOMRect = box(element.querySelector(".operation"));
      const text: DOMRect = box(element.querySelector(".operation-text"));
      const whole = (selector: string): readonly boolean[] => {
        const button: HTMLElement | null = element.querySelector<HTMLElement>(selector);
        const label: HTMLElement | null = button?.querySelector<HTMLElement>(".nol-button-label") ?? null;
        return [(label?.scrollWidth ?? 1) <= (label?.clientWidth ?? 0), box(button).left >= banner.left && box(button).right <= banner.right];
      };
      const commitOf = (side: string): readonly unknown[] => {
        const head: Element | null = element.querySelector(`.pane-head.${side}`);
        const commit: Element | null = head?.querySelector(".side-commit") ?? null;
        const label: DOMRect = box(head?.querySelector(".label") ?? null);
        return [commit?.textContent?.trim() ?? "", box(commit).width > 0 && box(commit).left >= label.left - 0.5 && box(commit).right <= label.right + 0.5];
      };

      await page.screenshot({ element, path: `${screenshots}/git-conflicts-30rem-${mode}.png` });
      expect([whole(".operation .abort"), whole(".operation .continue")]).toEqual([[true, true], [true, true]]);
      expect(box(element.querySelector(".operation .abort")).top).toBeGreaterThanOrEqual(text.bottom);
      expect([commitOf("ours"), commitOf("theirs")]).toEqual([["· 3b9f001", true], ["· e07a3c2", true]]);
      expect(GitLayout.problemsOf(element).filter(t => !t.startsWith("scrolls sideways: div.nol-code-editor-scroller "))).toEqual([]);
      const heads: readonly HTMLElement[] = [...element.querySelectorAll<HTMLElement>(".pane-head")];
      expect(heads.flatMap(head => [...head.querySelectorAll<HTMLElement>("button")].map(button => {
        const label: HTMLElement | null = button.querySelector<HTMLElement>(".nol-toolbar-button-label, .nol-button-label");
        return [button.className.split(" ")[0], (label?.scrollWidth ?? 0) <= (label?.clientWidth ?? 0), box(button).left >= box(head).left && box(button).right <= box(head).right];
      }))).toEqual(heads.flatMap(head => [...head.querySelectorAll<HTMLElement>("button")].map(button => [button.className.split(" ")[0], true, true])));
    });
});
