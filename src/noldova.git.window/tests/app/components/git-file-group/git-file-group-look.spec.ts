/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileState } from "@noldova/git.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { GitContrast } from "../../../fixtures/git-contrast.fixture.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitFileGroupComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      AppearanceFixture.reset();
    }
  });

  it.each(AppearanceFixture.modes)("keeps every syntax color readable on the context, added and removed lines of an open diff, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([GitFixtures.entry("src/shape.ts", FileState.Unmodified, FileState.Modified)]).toJson(),
      "git.diff": GitFixtures.diff("src/shape.ts", ...GitContrast.lines).toJson()
    });
    const row: HTMLElement = view.find("nol-git-file-group li:has(.file)");
    row.querySelector<HTMLElement>(".expand")?.click();
    await view.untilAsync(() => row.querySelectorAll(".diff [class^='token-']").length > 30);
    const lowest: ReadonlyMap<string, number> = GitContrast.lowestOf(row, ".diff > .line:not(.hunk)");
    console.info(`Changes list syntax contrast in ${mode} mode: ${GitContrast.format(lowest)}`);
    await page.screenshot({ element: row, path: `${screenshots}/git-file-group-diff-${mode}.png` });

    expect([...new Set([...lowest.keys()].map(t => t.split(" ")[0]))]).toEqual(["added", "context", "removed"]);
    const backgrounds: readonly (readonly string[])[] = GitContrast.backgroundsOf(row, ".diff > .line");
    expect([backgrounds[0], backgrounds[1]?.includes("rgba(0, 0, 0, 0)")]).toEqual([backgrounds[1], false]);
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style.color = "var(--nol-code-keyword)";
    row.append(probe);
    expect(getComputedStyle(row.querySelector(".token-keyword") ?? row).color).toBe(getComputedStyle(probe).color);
    probe.remove();
    expect([...lowest].filter(([, ratio]) => ratio < 3), GitContrast.format(lowest)).toEqual([]);
    expect([...lowest].filter(([, ratio]) => ratio < 4.5).map(([key]) => key), GitContrast.format(lowest)).toEqual(GitContrast.belowText[mode]);
  });
});
