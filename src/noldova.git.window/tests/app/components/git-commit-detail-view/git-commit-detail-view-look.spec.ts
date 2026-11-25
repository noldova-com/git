/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommit, GitCommitDetail, GitGraphCommit, LineKind } from "@noldova/git.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitCommitView } from "../../../../src/app/models/git-commit-view.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { FixtureLine, GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitLayout } from "../../../fixtures/git-layout.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitCommitDetailViewComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();
  const commit: GitGraphCommit = new GitGraphCommit(new GitCommit("c".repeat(40), ["d".repeat(40)], "Sample Author", "2026-11-20T14:02:00Z", "Follow renames"),
    "author@example.com", []);
  const answers = {
    ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff("src/services/reader.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
    "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson()
  };

  const resolve = (color: string): string => {
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style.color = color;
    document.body.append(probe);
    const resolved: string = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  };

  /** Sets the view at a dock's width beside the Git panel. */
  const dock = async (view: GitViewFixture): Promise<DOMRect> => {
    view.element.style.width = "21rem";
    view.element.style.height = "30rem";
    view.panel.style.width = "21rem";
    await view.fixture.whenStable();
    return box(view.element);
  };

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      AppearanceFixture.reset();
    }
  });

  it.each(AppearanceFixture.modes)("lays the chosen commit out at the dock's width with its text on one edge 0.75rem in, nothing cut, beside the panel's status, on the dock's background with none of its own, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
      GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
      const view: GitViewFixture = await GitViewFixture.renderCommitAsync(answers, ".detail .files");
      const host: DOMRect = await dock(view);
      const starts: readonly number[] = [".id-row", ".subject", ".author", ".actions"].map(t => rem(box(view.find(t)).left - host.left));

      expect(starts).toEqual([0.75, 0.75, 0.75, 0.75]);
      expect([rem(box(view.find(".id-row")).top - host.top), rem(host.right - box(view.find(".id-row")).right)]).toEqual([0.75, 0.75]);
      expect([view.element.scrollWidth <= view.element.clientWidth, getComputedStyle(view.element).backgroundColor, GitLayout.problemsOf(view.element)])
        .toEqual([true, "rgba(0, 0, 0, 0)", []]);
      expect([view.panel.querySelectorAll(".body").length, view.panel.querySelectorAll(".detail").length]).toEqual([1, 0]);
      await page.screenshot({ element: view.element, path: `${screenshots}/git-commit-detail-view-${mode}.png` });
    });

  it.each(AppearanceFixture.modes)("fits a 30rem column with the chosen commit, with nothing cut, outside it or overlapping, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync(answers, ".detail .files");
    view.element.style.width = "30rem";
    view.element.style.height = "40rem";
    await view.fixture.whenStable();

    await page.screenshot({ element: view.element, path: `${screenshots}/git-commit-detail-view-30rem-${mode}.png` });
    expect([view.element.scrollWidth <= view.element.clientWidth, GitLayout.problemsOf(view.element)]).toEqual([true, []]);
  });

  it.each(AppearanceFixture.modes)("says how to choose a commit, muted, 0.75rem in from the view's edges and wrapped inside them, on the dock's background, while none is chosen, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync(answers, ".empty-view");
    const host: DOMRect = await dock(view);
    const empty: HTMLElement = view.find(".empty-view");
    const text: DOMRect = box(empty);

    expect([view.texts(".empty-view"), rem(text.left - host.left), rem(text.top - host.top), rem(host.right - text.right)])
      .toEqual([["Choose a commit in History to see it here"], 0.75, 0.75, 0.75]);
    expect([getComputedStyle(empty).color, getComputedStyle(view.element).backgroundColor, view.element.scrollWidth <= view.element.clientWidth, GitLayout.problemsOf(view.element)])
      .toEqual([resolve("var(--nol-text-muted)"), "rgba(0, 0, 0, 0)", true, []]);
    await page.screenshot({ element: view.element, path: `${screenshots}/git-commit-detail-view-empty-${mode}.png` });
  });
});
