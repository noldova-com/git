/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitCommit, GitGraph, GitGraphCommit, GitRef, RefKind } from "@noldova/git.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitHistoryComponent } from "../../../../src/app/components/git-history/git-history.component.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitLayout } from "../../../fixtures/git-layout.fixture.ts";

describe("GitHistoryComponent ref chips", () => {
  const long: string = "sample/1234-a-branch-whose-name-is-far-too-long-for-the-column";
  const graph: GitGraph = new GitGraph([
    new GitGraphCommit(new GitCommit("a".repeat(40), ["b".repeat(40)], "Sample Author", "2026-11-06T17:30:00Z", "Second"), "author@example.com", [
      new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main"), new GitRef(RefKind.RemoteBranch, "origin/main"), new GitRef(RefKind.RemoteBranch, "upstream/main"),
      new GitRef(RefKind.Branch, "feature"), new GitRef(RefKind.Tag, "v1"), new GitRef(RefKind.Tag, "v1.1")
    ]),
    new GitGraphCommit(new GitCommit("b".repeat(40), ["c".repeat(40)], "Sample Author", "2026-11-05T17:30:00Z", "First"), "author@example.com", [
      new GitRef(RefKind.Branch, long), new GitRef(RefKind.RemoteBranch, `origin/${long}-on-the-remote`), new GitRef(RefKind.Tag, "v0.9")
    ]),
    new GitGraphCommit(new GitCommit("c".repeat(40), [], "Sample Author", "2026-11-04T17:30:00Z", "Start"), "author@example.com", [new GitRef(RefKind.RemoteBranch, "origin/topic")])
  ], false);
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();
  const until = async (condition: () => boolean): Promise<void> => {
    for (let tries = 0; !condition() && tries < 200; tries++)
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  };

  const mountAsync = async (width: string = "60rem"): Promise<HTMLElement> => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.graph": graph.toJson(), "git.status": GitFixtures.status().toJson() });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.style.display = "block";
    element.style.width = width;
    element.style.height = "20rem";
    await until(() => element.querySelectorAll("[role=option]").length === 3);
    await fixture.whenStable();
    return element;
  };
  const chipsOf = (row: Element): readonly (readonly string[])[] =>
    [...row.querySelectorAll<HTMLElement>(".chip")].map(t => [t.children.length === 0 ? (t.textContent ?? "").trim() : [...t.children].map(u => u.textContent ?? "").join(" "), t.title]);

  it("shows a local branch, then each remote holding it on the same commit as its own chip named for the remote, marks the current branch, and collapses the rest into +N", async () => {
    const element: HTMLElement = await mountAsync();
    const rows: readonly Element[] = [...element.querySelectorAll("[role=option]")];

    expect(rows.map(chipsOf)).toEqual([
      [["computer main", "main"], ["cloud origin", "origin/main"], ["+4", "upstream/main, feature, v1, v1.1"]],
      [[`computer ${long}`, long], [`cloud origin/${long}-on-the-remote`, `origin/${long}-on-the-remote`], ["+1", "v0.9"]],
      [["cloud origin/topic", "origin/topic"]]
    ]);
    expect([...rows[0]?.querySelectorAll(".chip") ?? []].map(t => [t.classList.contains("current"), getComputedStyle(t).fontWeight])).toEqual([
      [true, "500"], [false, "400"], [false, "400"]
    ]);
    expect(rows[0]?.querySelector(".chip.more")?.classList.contains("ltag")).toBe(true);
  });

  it.each(AppearanceFixture.modes)("lines the chips up a gap apart on one centre line, 1.25rem high with 0.875rem marks, and keeps +N whole beside long names, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    onTestFinished(() => AppearanceFixture.reset());
    const element: HTMLElement = await mountAsync();
    const [first, second] = [...element.querySelectorAll("[role=option]")];
    const geometry = (row: Element | undefined): readonly number[] => {
      const chips: readonly DOMRect[] = [...row?.querySelectorAll(".chip") ?? []].map(box);
      return chips.flatMap((t, index) => [rem(t.height), rem(t.top + t.height / 2 - (chips[0]?.top ?? 0) - (chips[0]?.height ?? 0) / 2), index === 0 ? 0 : rem(t.left - (chips[index - 1]?.right ?? 0))]);
    };

    expect(geometry(first)).toEqual([1.25, 0, 0, 1.25, 0, 0.25, 1.25, 0, 0.25]);
    expect(geometry(second)).toEqual([1.25, 0, 0, 1.25, 0, 0.25, 1.25, 0, 0.25]);
    expect([...first?.querySelectorAll(".chip-icon") ?? []].map(t => [rem(box(t).width), rem(box(t).height)])).toEqual([[0.875, 0.875], [0.875, 0.875]]);
    const [local, remote] = [...first?.querySelectorAll<HTMLElement>(".chip") ?? []].map(t => getComputedStyle(t));
    expect([remote?.backgroundColor, remote?.boxShadow, remote?.color]).toEqual([local?.backgroundColor, local?.boxShadow, local?.color]);
    const cell: DOMRect = box(second?.querySelector(".cell") ?? null);
    const more: HTMLElement | null = second?.querySelector<HTMLElement>(".chip.more") ?? null;
    const name: HTMLElement | null = second?.querySelector<HTMLElement>(".chip .ellipsis") ?? null;
    expect([box(more).right <= cell.right, more?.scrollWidth === more?.clientWidth, (name?.scrollWidth ?? 0) > (name?.clientWidth ?? 0)]).toEqual([true, true, true]);
  });

  it.each(AppearanceFixture.modes)("shows one chip, readable to 8rem, and folds the rest into +N in a 30rem middle, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    onTestFinished(() => AppearanceFixture.reset());
    const element: HTMLElement = await mountAsync("30rem");
    await until(() => element.querySelectorAll("[role=option]")[0]?.querySelectorAll(".chip").length === 2);
    const rows: readonly Element[] = [...element.querySelectorAll("[role=option]")];
    const fits = (row: Element | undefined): readonly unknown[] => {
      const cell: DOMRect = box(row?.querySelector(".cell") ?? null);
      const [chip, more] = [...row?.querySelectorAll<HTMLElement>(".chip") ?? []];
      return [rem(box(chip ?? null).width) >= 8 || (chip?.scrollWidth ?? 1) <= (chip?.clientWidth ?? 0), more === undefined || (box(more).right <= cell.right && more.scrollWidth === more.clientWidth)];
    };

    expect(rows.map(chipsOf)).toEqual([
      [["computer main", "main"], ["+5", "origin/main, upstream/main, feature, v1, v1.1"]],
      [[`computer ${long}`, long], ["+2", `origin/${long}-on-the-remote, v0.9`]],
      [["cloud origin/topic", "origin/topic"]]
    ]);
    expect(rows.map(fits)).toEqual(rows.map(() => [true, true]));
  });

  it.each(AppearanceFixture.modes)("fits a 30rem middle column, with nothing cut, outside it or overlapping, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    onTestFinished(() => AppearanceFixture.reset());
    const element: HTMLElement = await mountAsync("30rem");

    await page.screenshot({ element, path: `../../../../../../_build/window/screenshots/git-history-30rem-${mode}.png` });
    expect(GitLayout.problemsOf(element)).toEqual([]);
  });
});
