/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ConflictKind, FailureCode, FileState, GitBranches, GitCode, GitOperation, GitRemote, LineCounts, LineKind, OperationKind, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";
import { computed } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import type {} from "@vitest/browser-playwright";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, PointerFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { GitViewComponent } from "../../../../src/app/components/git-view/git-view.component.ts";
import { GitFolder } from "../../../../src/app/services/git-folder.ts";
import { type FailedRequest, GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitViewComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();
  const loadedAsync = (view: GitViewFixture, group: Element): Promise<void> =>
    view.untilAsync(() => (group.querySelector(".diff")?.textContent ?? "Reading the diff…") !== "Reading the diff…");
  const status = GitFixtures.status([
    GitFixtures.entry("src/app/app-adapter.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified),
    GitFixtures.entry("src/models/sample-model.ts", FileState.Modified, FileState.Unmodified, new LineCounts(38, 9)),
    GitFixtures.entry("src/Example.Project.Core/src/resources.ts", FileState.Unmodified, FileState.Modified, new LineCounts(2, 0)),
    GitFixtures.entry("documents/ARCHITECTURE.md", FileState.Unmodified, FileState.Modified, new LineCounts(4, 1)),
    GitFixtures.entry("src/enums/sample-run-failure-kind.ts", FileState.Untracked, FileState.Untracked, new LineCounts(9, 0))
  ], new StatusUpstream("origin/sample/1234-branch", 2, 0, false), {
    branch: "sample/1234-branch",
    operation: new GitOperation(OperationKind.Merge, "main", "Merge branch 'main' into sample/1234-branch"),
    remote: new GitRemote("nas", "nas.home", "notes", RemoteTransport.Ssh)
  });
  const diff = GitFixtures.diff("src/Example.Project.Core/src/resources.ts", [LineKind.Context, "  public static formatSampleServerRunFailed("],
    [LineKind.Added, "    if (failure.kind === SampleRunFailureKind.Untrusted)"], [LineKind.Removed, "      return `${failure.server} refused`;"]);

  const resolve = (color: string): string => {
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style.color = color;
    document.body.append(probe);
    const resolved: string = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  };

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      try {
        await cdp().send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "none" }] });
      }
      finally {
        AppearanceFixture.reset();
      }
    }
  });

  it.each(AppearanceFixture.modes)("lays out the cards, rows and inline diff in a 25rem dock in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": status.toJson(), "git.diff": diff.toJson() });
    view.element.style.width = "25rem";
    view.element.style.height = "40rem";
    const changes: HTMLElement = view.find("nol-git-file-group:nth-of-type(3)");
    changes.querySelector<HTMLElement>(".expand")?.click();
    await loadedAsync(view, changes);
    await view.fixture.whenStable();

    const frame: DOMRect = box(view.element);
    const cards: readonly DOMRect[] = [...view.find(".body").children].filter(t => t.localName !== "p").map(t => box(t));
    const card: DOMRect = cards[0] ?? new DOMRect();
    const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(3) .file");
    const changesBox: DOMRect = box(changes);

    expect([rem(card.left - frame.left), rem(card.top - frame.top), rem(card.width)]).toEqual([0.5, 0.25, 24]);
    expect(cards.slice(1).map((t, i) => rem(t.top - (cards[i]?.bottom ?? 0)))).toEqual(cards.slice(1).map(() => 0.5));
    expect(cards.map(t => rem(t.width))).toEqual(cards.map(() => 24));
    expect(rem(box(changes.querySelector(".header")).height)).toBe(1.75);
    expect(rem(box(row).height)).toBe(1.75);
    expect(rem(box(row.querySelector(".state")).left - changesBox.left - 1)).toBe(0.625);
    expect(rem(changesBox.right - 1 - box(row.querySelector(".move")).right)).toBe(0.25);
    expect([rem(box(changes.querySelector(".diff > div")).height), getComputedStyle(changes.querySelector(".diff") ?? view.element).fontSize]).toEqual([1.125, "12px"]);
    expect(rem(box(view.find(".field")).height)).toBeGreaterThanOrEqual(4.25);
    const commitCard: HTMLElement = view.find<HTMLElement>("nol-git-commit-card");
    const commitBox: DOMRect = box(commitCard);
    const commit: DOMRect = box(view.find(".commit"));
    expect([rem(commit.left - commitBox.left - commitCard.clientLeft), rem(commitBox.right - commitCard.clientLeft - commit.right)]).toEqual([0.5, 0.5]);
    expect(rem(box(view.find("nol-git-branch-card .line")).height)).toBe(1.625);
    const pull: DOMRect = box(view.find("nol-git-branch-card .pull"));
    expect([rem(pull.height), rem(box(view.find("nol-git-branch-card .push")).left - pull.right)]).toEqual([1.625, 0.5]);
    const plain: HTMLElement = view.find<HTMLElement>(".plain");
    const plainBox: DOMRect = box(plain);
    const plainIcon: DOMRect = box(plain.querySelector(".material-symbols-rounded"));
    const plainText: Element | null = plain.querySelector(".plain-text");
    expect([rem(plainIcon.left - plainBox.left - plain.clientLeft), rem(box(plainText).left - plainIcon.right), rem(box(plainText).top - plainBox.top - plain.clientTop)])
      .toEqual([0.625, 0.5, 0.5]);
    expect(getComputedStyle(plainText ?? plain).fontSize).toBe("12px");

    await page.screenshot({ element: view.element, path: `${screenshots}/git-view-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("drops the branch menu over the cards inside the card's insets in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const branches: GitBranches = GitFixtures.branches("sample/1234-branch", ["sample/1234-branch", "main"], ["origin/main", "origin/sample/4321-long-branch"]);
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": status.toJson(), "git.branches": branches.toJson() });
    view.element.style.width = "25rem";
    view.element.style.height = "40rem";
    await view.clickAsync("nol-git-branch-card .name");
    await view.waitForAsync(".menu [role=option]");
    await view.fixture.whenStable();

    const branchCard: HTMLElement = view.find<HTMLElement>("nol-git-branch-card");
    const card: DOMRect = box(branchCard);
    const menu: DOMRect = box(view.find(".menu"));
    expect([rem(menu.left - card.left - branchCard.clientLeft), rem(card.right - branchCard.clientLeft - menu.right), rem(menu.top - card.top - branchCard.clientTop)])
      .toEqual([0.25, 0.25, 2.5]);
    expect(new Set(view.all(".menu .item").map(t => rem(box(t).height))).size).toBe(1);
    await page.screenshot({ element: view.element, path: `${screenshots}/git-view-branch-menu-${mode}.png` });

    view.find(".filter").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    await view.fixture.whenStable();
    const paint = (element: HTMLElement): readonly string[] => [getComputedStyle(element).backgroundColor, getComputedStyle(element).color, getComputedStyle(element).cursor];
    const active: HTMLElement = view.find(".menu .item.active");
    const current: HTMLElement = view.find(".menu .item.current");
    const other: HTMLElement = view.find(".menu .item:not(.active):not(.current)");
    expect(view.texts(".menu .item.active .title, .menu .item.current .title")).toEqual(["sample/1234-branch", "main"]);
    expect([paint(active), paint(current)]).toEqual([
      [resolve("var(--nol-list-active)"), resolve("var(--nol-list-active-text)"), "pointer"], [resolve("var(--nol-list-active)"), resolve("var(--nol-list-active-text)"), "pointer"]
    ]);
    expect([resolve("var(--nol-list-active)") === resolve("var(--nol-hover)"), paint(other)[2]]).toEqual([false, "pointer"]);
    await page.screenshot({ element: view.element, path: `${screenshots}/git-view-branch-menu-active-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("offers to publish a branch with no upstream at the card's insets, above its conflicts, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const unpublished = GitFixtures.status(status.entries, null, { branch: "sample/1234-branch", operation: status.operation, remote: status.remote });
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": unpublished.toJson() });
    view.element.style.width = "25rem";
    view.element.style.height = "40rem";
    await view.fixture.whenStable();

    const branchCard: HTMLElement = view.find<HTMLElement>("nol-git-branch-card");
    const card: DOMRect = box(branchCard);
    const publish: DOMRect = box(view.find("nol-git-branch-card .push"));
    const upstream: DOMRect = box(view.find("nol-git-branch-card .upstream span"));
    expect(view.texts("nol-git-branch-card .push .nol-button-label, nol-git-branch-card .upstream span")).toEqual(["Publish branch", "No upstream yet"]);
    expect([rem(publish.height), rem(card.right - branchCard.clientLeft - publish.right), rem(upstream.left - card.left - branchCard.clientLeft)]).toEqual([1.625, 0.625, 0.625]);
    expect(rem(box(view.find("nol-git-file-group:nth-of-type(1) .file")).height)).toBe(1.75);

    await page.screenshot({ element: view.element, path: `${screenshots}/git-view-no-upstream-${mode}.png` });
  });

  it("keeps the cards, rows and inline diff in place in forced colours, with their borders, signed diff lines, a Highlight outline on the open row and branch, and a Highlight fill on the active option",
    async () => {
      await cdp().send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
      const branches: GitBranches = GitFixtures.branches("sample/1234-branch", ["sample/1234-branch", "main"], ["origin/main"]);
      const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": status.toJson(), "git.diff": diff.toJson(), "git.branches": branches.toJson() });
      view.element.style.width = "25rem";
      view.element.style.height = "40rem";
      const changes: HTMLElement = view.find("nol-git-file-group:nth-of-type(3)");
      changes.querySelector<HTMLElement>(".expand")?.click();
      await loadedAsync(view, changes);
      await view.fixture.whenStable();

      const frame: DOMRect = box(view.element);
      const card: DOMRect = box(view.find(".body").firstElementChild);
      const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(3) .file");
      const highlight: string = resolve("Highlight");
      const outlineOf = (element: Element | null): readonly string[] => {
        const style: CSSStyleDeclaration = getComputedStyle(element ?? view.element);
        return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.outlineOffset];
      };
      expect([rem(card.left - frame.left), rem(card.top - frame.top), rem(card.width)]).toEqual([0.5, 0.25, 24]);
      expect([rem(box(changes.querySelector(".header")).height), rem(box(row).height), rem(box(changes.querySelector(".diff > div")).height)]).toEqual([1.75, 1.75, 1.125]);
      expect(rem(box(row.querySelector(".state")).left - box(changes).left - 1)).toBe(0.625);
      expect(view.all("nol-git-file-group, nol-git-branch-card, nol-git-commit-card").map(t => getComputedStyle(t).borderTopStyle))
        .toEqual(view.all("nol-git-file-group, nol-git-branch-card, nol-git-commit-card").map(() => "solid"));
      expect([changes.querySelector(".added-line")?.textContent?.startsWith("+"), changes.querySelector(".removed-line")?.textContent?.startsWith("-")]).toEqual([true, true]);
      expect(outlineOf(row)).toEqual(["dashed", "1px", highlight, "-1px"]);
      const item: DOMRect = box(row.closest("li"));
      expect([box(row).left, box(row).top, box(row).width]).toEqual([item.left, item.top, item.width]);

      await view.clickAsync("nol-git-branch-card .name");
      await view.waitForAsync(".menu [role=option]");
      await view.fixture.whenStable();
      const branchCard: HTMLElement = view.find<HTMLElement>("nol-git-branch-card");
      const menu: DOMRect = box(view.find(".menu"));
      expect([rem(menu.left - box(branchCard).left - branchCard.clientLeft), rem(box(branchCard).right - branchCard.clientLeft - menu.right)]).toEqual([0.25, 0.25]);
      const activeStyle: CSSStyleDeclaration = getComputedStyle(view.find(".menu .item.active"));
      expect([outlineOf(view.find("nol-git-branch-card .name")), activeStyle.backgroundColor, activeStyle.color, activeStyle.forcedColorAdjust])
        .toEqual([["dashed", "1px", highlight, "-1px"], highlight, resolve("HighlightText"), "none"]);

      await page.screenshot({ element: view.element, path: `${screenshots}/git-view-forced.png` });

      await userEvent.keyboard("{Escape}");
      await view.fixture.whenStable();
      const trigger: HTMLElement = view.find<HTMLElement>("nol-git-branch-card .name");
      await PointerFixture.hoverAsync(trigger);
      expect([view.all(".menu").length, document.activeElement === trigger, trigger.matches(":hover:focus-visible")]).toEqual([0, true, true]);
      expect(outlineOf(trigger)).toEqual(["solid", "2px", highlight, "-1px"]);
    });

  it.each(AppearanceFixture.modes)("sets the unfollowed-changes notice's icon, text and Check again on the banner's insets, under the branch card, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.watch": GitFixtures.lost("The folder has too many files to watch.") },
      "[role=status]");
    view.element.style.width = "25rem";
    view.element.style.height = "40rem";
    await view.fixture.whenStable();

    const notice: HTMLElement = view.find<HTMLElement>("[role=status]");
    const noticeBox: DOMRect = box(notice);
    const icon: DOMRect = box(notice.querySelector(".banner-icon"));
    const text: DOMRect = box(notice.querySelector(".banner-text"));
    const action: DOMRect = box(notice.querySelector(".banner-action"));
    expect([rem(noticeBox.width), rem(noticeBox.top - box(view.find("nol-git-branch-card")).bottom)]).toEqual([24, 0.5]);
    expect([rem(icon.left - noticeBox.left - notice.clientLeft), rem(text.left - icon.right), rem(action.left - text.right), rem(noticeBox.right - notice.clientLeft - action.right)])
      .toEqual([0.625, 0.5, 0.5, 0.625]);
    expect(getComputedStyle(notice.querySelector(".banner-icon") ?? notice).color).toBe(resolve("var(--nol-warning)"));

    await page.screenshot({ element: view.element, path: `${screenshots}/git-view-unfollowed-${mode}.png` });
  });

  const emptyStates: readonly (readonly [string, FailedRequest, string])[] = [
    ["not-repository", GitFixtures.failure(FailureCode.NotRepository), "Not a Git repository"],
    ["folder-unreadable", GitFixtures.failure(FailureCode.Unavailable, GitCode.FolderUnreadable), "Can't read this folder"],
    ["git-missing", GitFixtures.failure(FailureCode.Unavailable, GitCode.GitMissing), "Git isn't installed"],
    ["too-old", GitFixtures.failure(FailureCode.Unavailable, GitCode.GitTooOld, "Git is too old.", "2.34.1"), "Git 2.34.1 is too old"]
  ];

  it.each(emptyStates.flatMap(([name, failure, heading]) => AppearanceFixture.modes.map((mode): readonly [string, typeof mode, FailedRequest, string] => [name, mode, failure, heading])))("draws the %s state's icon, heading and text on one edge in %s mode", async (name, mode, failure, heading) => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": failure }, ".empty");
    view.element.style.width = "25rem";
    view.element.style.height = "40rem";
    await view.fixture.whenStable();

    const edges: readonly number[] = view.all(".empty-icon, .heading, .text").map(t => rem(box(t).left));
    expect(view.texts(".heading")).toEqual([heading]);
    expect([rem(box(view.find(".empty-icon")).width), new Set(edges).size, getComputedStyle(view.find(".heading")).fontSize, getComputedStyle(view.find(".text")).fontSize])
      .toEqual([1.25, 1, "13px", "13px"]);

    await page.screenshot({ element: view.element, path: `${screenshots}/git-view-${name}-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("draws the folder-failed state's icon, heading and text on one edge, in that order, with no action, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    onTestFinished(GitFolder.provide(context, computed((): string => {
      throw new Error("No chat is shown, so the app has no folder to give the Git view.");
    })));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const fixture: ComponentFixture<GitViewComponent> = TestBed.createComponent(GitViewComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.style.width = "25rem";
    element.style.height = "40rem";
    await fixture.whenStable();

    const parts: readonly Element[] = [...element.querySelectorAll(".empty-icon, .heading, .text")];
    const boxes: readonly DOMRect[] = parts.map(t => box(t));
    expect(parts.map(t => (t.textContent ?? "").trim()))
      .toEqual(["error", "The app's folder couldn't be read", "No chat is shown, so the app has no folder to give the Git view."]);
    expect([rem(boxes[0]?.width ?? 0), new Set(boxes.map(t => rem(t.left))).size, element.querySelectorAll(".actions").length]).toEqual([1.25, 1, 0]);
    const empty: HTMLElement | null = element.querySelector<HTMLElement>(".empty");
    const emptyBox: DOMRect = box(empty);
    const emptyStyle: CSSStyleDeclaration = getComputedStyle(empty ?? element);
    expect(boxes.slice(1).map((t, i) => rem(t.top - (boxes[i]?.bottom ?? t.top)))).toEqual([0.5, 0.5]);
    expect([rem((boxes[0]?.left ?? 0) - emptyBox.left), rem((boxes[0]?.top ?? 0) - emptyBox.top)])
      .toEqual([rem(Number.parseFloat(emptyStyle.paddingLeft)), rem(Number.parseFloat(emptyStyle.paddingTop))]);
    expect(boxes.map(t => t.right <= emptyBox.right - Number.parseFloat(emptyStyle.paddingRight) + 1 / 32)).toEqual([true, true, true]);
    expect([getComputedStyle(parts[1] ?? element).fontSize, getComputedStyle(parts[2] ?? element).fontSize]).toEqual(["13px", "13px"]);

    await page.screenshot({ element, path: `${screenshots}/git-view-folder-failed-${mode}.png` });
  });
});
