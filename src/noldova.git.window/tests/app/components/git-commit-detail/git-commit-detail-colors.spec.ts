/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ShikiLineTokenizer } from "@noldova/editor.angular";
import { GitCommit, GitCommitDetail, GitGraphCommit, LineKind } from "@noldova/git.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";

import { GitCommitView } from "../../../../src/app/models/git-commit-view.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { GitContrast } from "../../../fixtures/git-contrast.fixture.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitCommitDetailComponent's diff colors", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const email: string = "user-1@host-1.example";

  const showAsync = async (path: string, lines: readonly [LineKind, string][]): Promise<GitViewFixture> => {
    onTestFinished(() => GitViewing.commit.set(null));
    GitViewing.commit.set(new GitCommitView(GitFixtures.folder, new GitGraphCommit(
      new GitCommit("c".repeat(40), ["d".repeat(40)], "Sample Author", "2026-11-20T14:02:00Z", "Follow renames"), email, [])));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff(path, ...lines).toJson(),
      "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", email, "2026-11-20T14:02:00Z", false).toJson()
    }, ".detail");
    await view.waitForAsync(".file-row:not(.folder)");
    return view;
  };

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      AppearanceFixture.reset();
    }
  });

  it("colors an open file's diff as the editor does, its signs plain and its lines on their backgrounds, and reads no file in a closed folder", async () => {
    const read = vi.spyOn(ShikiLineTokenizer.prototype, "tokenizeLine");
    onTestFinished(() => read.mockRestore());
    const view: GitViewFixture = await showAsync("src/services/reader.ts", [[LineKind.Context, "const a = 1;"], [LineKind.Removed, "/* old"], [LineKind.Added, "let b = 2;"]]);
    const lines = (): readonly HTMLElement[] => view.all(".diff > div:not(.meta-line)");
    const colored = (line: Element): string => [...line.querySelectorAll("span")].filter(t => t.className === "token-keyword" || t.className === "token-comment")
      .map(t => `${t.className}:${t.textContent}`).join(" ");

    await view.clickAsync(".file-row:not(.folder)");
    await view.untilAsync(() => lines().length === 3 && colored(lines()[2] ?? view.element) !== "");
    const shown: readonly string[] = lines().map(colored);
    const signs: readonly (string | null)[] = lines().map(t => [...t.childNodes].find(u => u.nodeType === Node.TEXT_NODE)?.textContent ?? null);
    const kinds: readonly string[] = lines().map(t => ["removed-line", "added-line"].find(u => t.classList.contains(u)) ?? "");
    const reads: number = read.mock.calls.length;
    await view.clickAsync(".file-row.folder");
    await view.untilAsync(() => view.all(".diff").length === 0);

    expect(shown).toEqual(["token-keyword:const", "token-comment:/* old", "token-keyword:let"]);
    expect([signs, lines().length]).toEqual([[" ", "-", "+"], 0]);
    expect(kinds).toEqual(["", "removed-line", "added-line"]);
    expect(new Set(read.mock.calls.map(t => t[0]))).toEqual(new Set(["const a = 1;", "/* old", "let b = 2;"]));
    expect(read.mock.calls.length).toBe(reads);
  });

  it.each(AppearanceFixture.modes)("keeps every syntax color readable on the context, added and removed lines of a commit's open diff, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const view: GitViewFixture = await showAsync("shape.ts", GitContrast.lines);
    view.element.style.width = "40rem";
    await view.clickAsync(".file-row:not(.folder)");
    await view.untilAsync(() => view.all(".diff [class^='token-']").length > 30);
    const lowest: ReadonlyMap<string, number> = GitContrast.lowestOf(view.find(".diff"), ".diff > div:not(.meta-line)");
    console.info(`Commit diff syntax contrast in ${mode} mode: ${GitContrast.format(lowest)}`);
    await page.screenshot({ element: view.find(".diff"), path: `${screenshots}/git-commit-detail-diff-${mode}.png` });

    expect([...new Set([...lowest.keys()].map(t => t.split(" ")[0]))]).toEqual(["added", "context", "removed"]);
    const backgrounds: readonly (readonly string[])[] = GitContrast.backgroundsOf(view.find(".diff"), ".diff > div");
    expect([backgrounds[0], backgrounds[1]?.includes("rgba(0, 0, 0, 0)")]).toEqual([backgrounds[1], false]);
    expect([...lowest].filter(([, ratio]) => ratio < 3), GitContrast.format(lowest)).toEqual([]);
    expect([...lowest].filter(([, ratio]) => ratio < 4.5).map(([key]) => key), GitContrast.format(lowest)).toEqual(GitContrast.belowText[mode]);
  });
});
