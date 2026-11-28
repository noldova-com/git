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
import type { JsonValue } from "@noldova/context.json";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitBranchTrack, GitCommit, GitGraph, GitGraphCommit, GitRef, GitRemote, GitRepositoryItems, GitWorktrees, RefKind, RemoteTransport } from "@noldova/git.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture, PointerFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";

import { GitHistoryComponent } from "../../../../src/app/components/git-history/git-history.component.ts";
import { GitRepositoryComponent } from "../../../../src/app/components/git-repository/git-repository.component.ts";
import { GitPullRequestList } from "../../../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../../../src/app/models/git-pull-request-row.ts";
import { GitRepositoryLink } from "../../../../src/app/models/git-repository-link.ts";
import { GitPullRequests } from "../../../../src/app/services/git-pull-requests.ts";
import { GitRepositoryLinks } from "../../../../src/app/services/git-repository-links.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";
import { RightEdge } from "../../../fixtures/right-edge.fixture.ts";
import { Wait } from "../../../fixtures/wait.fixture.ts";

describe("GitRepositoryComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const head: string = "a".repeat(40);
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000 + 0;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();

  const untilAsync = (done: () => boolean): Promise<void> => {
    if (done())
      return Promise.resolve();
    return new Promise(resolve => {
      const observer: MutationObserver = new MutationObserver(() => {
        if (!done())
          return;
        observer.disconnect();
        resolve();
      });
      observer.observe(document.body, { attributes: true, characterData: true, childList: true, subtree: true });
    });
  };

  async function renderAsync(extra: Readonly<Record<string, JsonValue>> = {}): Promise<HTMLElement> {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const answers: Readonly<Record<string, JsonValue>> = {
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([], null, { head, remote: new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https) }).toJson(),
      "git.graph": new GitGraph([new GitGraphCommit(new GitCommit(head, [], "Sample Author", "2026-11-06T17:30:00Z", "Start"), "author@example.com",
        [new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main")])], false).toJson(),
      "git.branches": GitFixtures.branches("main", ["feature", "main"]).toJson(),
      "git.worktrees": new GitWorktrees([]).toJson(),
      "git.repositoryItems": new GitRepositoryItems([], [], [], false).toJson(),
      "git.remoteTracks": { tracks: [] },
      ...extra
    };
    GitFixtures.answerWith(context, answers);
    context.allow("openDocument");
    onTestFinished(GitPullRequests.provide(context, {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "git-github.account",
      listFor: () => signal(GitPullRequestList.ready([new GitPullRequestRow("214", "#214", "Draw lanes on a canvas", "https://github.com/example-owner/example-repository/pull/214",
        false, 2, 1, 0, 0, "feature")])),
      refresh: () => undefined
    }));
    onTestFinished(GitRepositoryLinks.provide({ linksFor: () => [new GitRepositoryLink("sprint", "Sprint", "view_kanban", () => undefined)] }));
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.style.width = "20rem";
    await untilAsync(() => !Object.isNull(element.querySelector(".pull-request")) && !Object.isNull(element.querySelector("button[title=feature]")));
    return element;
  }

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("puts the kit's spinner where the first branch's icon goes while the branches are read, centred in a branch row, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const answers: Readonly<Record<string, JsonValue>> = {
      ...GitFixtures.watching,
      "git.status": GitFixtures.status().toJson(),
      "git.branches": GitFixtures.branches("main", ["feature", "main"]).toJson(),
      "git.worktrees": new GitWorktrees([]).toJson(),
      "git.repositoryItems": new GitRepositoryItems([], [], [], false).toJson(),
      "git.remoteTracks": { tracks: [] }
    };
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.branches"], answers);
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.style.width = "20rem";
    await untilAsync(() => !Object.isNull(element.querySelector(".row.reading nol-spinner:not(.nol-reveal-pending)")));
    await page.screenshot({ element, path: `${screenshots}/git-repository-reading-${mode}.png` });
    const header = (): DOMRect => box([...element.querySelectorAll(".toggle")].find(t => t.textContent?.includes("Branches") === true)?.closest(".row") ?? null);
    const reading: DOMRect = box(element.querySelector(".row.reading"));
    const spinner: DOMRect = box(element.querySelector(".row.reading nol-spinner"));
    const below: number = reading.top - header().bottom;

    await held.answerAsync("git.branches", answers["git.branches"] ?? null);
    await untilAsync(() => !Object.isNull(element.querySelector("button[title=feature] .octicon")));
    const row: DOMRect = box(element.querySelector("button[title=feature]"));
    const icon: DOMRect = box(element.querySelector("button[title=feature] .octicon"));

    expect([rem(below - (row.top - header().bottom)), rem(reading.height - row.height), rem(spinner.left - icon.left), rem(spinner.width - icon.width),
      rem(spinner.top + spinner.height / 2 - reading.top - reading.height / 2)]).toEqual([0, 0, 0, 0, 0]);
  });

  it.each(AppearanceFixture.modes)("ends New branch's glyph where the Pull requests header's host label ends, and Fetch all's at the same edge, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync();
    const glyph = (selector: string): DOMRect => box(element.querySelector(`${selector} .nol-icon-button-glyph`));
    const host: DOMRect = box(element.querySelector("nol-git-pull-requests .host"));
    const probe: HTMLElement = document.body.appendChild(document.createElement("div"));
    probe.style.width = "var(--nol-icon)";
    const icon: number = rem(box(probe).width);
    probe.remove();

    expect([rem(glyph(".new-branch").width), rem(glyph(".fetch-all").width)]).toEqual([icon, icon]);
    expect([rem(glyph(".new-branch").right - host.right), rem(glyph(".fetch-all").right - host.right)]).toEqual([0, 0]);
  });

  it.each(AppearanceFixture.modes)("draws Fetch all and New branch as the kit's icon buttons, ending at one edge, and leaves a section's title unlit under the pointer, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const element: HTMLElement = await renderAsync();
      const fetchAll: HTMLElement | null = element.querySelector(".fetch-all");
      const newBranch: HTMLElement | null = element.querySelector(".new-branch");
      const headings: HTMLElement[] = [...element.querySelectorAll<HTMLElement>(".row.heading")];
      const probe: HTMLElement = document.body.appendChild(document.createElement("div"));
      probe.style.width = "var(--nol-icon-button-target)";
      const kit: number = rem(box(probe).width);
      probe.remove();
      const fills: string[] = [];
      for (const heading of headings) {
        await userEvent.hover(heading.querySelector(".caps") ?? heading);
        fills.push(getComputedStyle(heading).backgroundColor);
      }
      await userEvent.unhover(document.body);

      expect([fetchAll?.hasAttribute("nol-icon-button"), newBranch?.hasAttribute("nol-icon-button")]).toEqual([true, true]);
      expect([rem(box(fetchAll).width), rem(box(fetchAll).height), rem(box(newBranch).width), rem(box(newBranch).height)]).toEqual([kit, kit, kit, kit]);
      expect(rem(box(newBranch).right - box(fetchAll).right)).toBe(0);
      expect([headings.length, new Set(fills)]).toEqual([6, new Set(["rgba(0, 0, 0, 0)"])]);
    });

  it.each(AppearanceFixture.modes)("indents a pull request's dot and title as a branch row's icon and name, under its section title's text, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync();
    const branch: HTMLElement | null = element.querySelector("button[title=feature]");
    const pullRequest: HTMLElement | null = element.querySelector(".pull-request");
    const title: HTMLElement | undefined = [...element.querySelectorAll<HTMLElement>("nol-git-pull-requests .caps")].find(t => t.textContent?.trim() === "Pull requests");

    expect(rem(box(pullRequest?.querySelector(".dot") ?? null).left - box(branch?.querySelector(".octicon") ?? null).left)).toBe(0);
    expect(rem(box(pullRequest?.querySelector(".title") ?? null).left - box(branch?.querySelector(".grow") ?? null).left)).toBe(0);
    expect(rem(box(pullRequest?.querySelector(".dot") ?? null).left - box(title ?? null).left)).toBe(0);
    expect(rem(box(pullRequest).left - box(branch).left)).toBe(0);
  });

  it.each(AppearanceFixture.modes)("spaces each section after Branches the panel's gap from the one before, its pull requests' last row included, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync();
    const headers = (): HTMLElement[] => [...element.querySelectorAll<HTMLElement>(".caps")].map(t => t.closest<HTMLElement>(".row") ?? t);
    const headerOf = (name: string): HTMLElement | undefined => headers().find(t => t.querySelector(".caps")?.textContent?.trim() === name);
    const names = (): string[] => headers().map(t => t.querySelector(".caps")?.textContent?.trim() ?? "");
    headerOf("Branches")?.querySelector<HTMLElement>(".toggle")?.click();
    headerOf("Pull requests")?.querySelector<HTMLElement>(".toggle")?.click();
    await untilAsync(() => Object.isNull(element.querySelector("button[title=feature]")) && Object.isNull(element.querySelector(".pull-request")));
    const shown: HTMLElement[] = headers().slice(names().indexOf("Branches"));
    const collapsed: number[] = shown.slice(1).map((t, i) => rem(box(t).top - box(shown[i] ?? t).bottom));

    headerOf("Pull requests")?.querySelector<HTMLElement>(".toggle")?.click();
    await untilAsync(() => !Object.isNull(element.querySelector(".pull-request")));
    const rows: HTMLElement[] = [...element.querySelectorAll<HTMLElement>(".pull-request")];
    const expanded: number = rem(box(headerOf("Remotes") ?? null).top - box(rows.at(-1) ?? null).bottom);

    expect(shown.map(t => t.querySelector(".caps")?.textContent?.trim())).toEqual(["Branches", "Pull requests", "Remotes", "Tags", "Stashes", "Worktrees", "Submodules"]);
    expect([...collapsed, expanded]).toEqual(Array.from({ length: 7 }, () => 0.125));
  });

  it.each(AppearanceFixture.modes)("lays a host's row out as History: the same height, icon and text edges, under it by the gap History keeps under Changes, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync();
    await untilAsync(() => !Object.isNull(element.querySelector(".row.link")));
    const history: HTMLElement | null = element.querySelector(".row.history");
    const link: HTMLElement | null = element.querySelector(".row.link");
    const changes: HTMLElement | null = element.querySelector(".row.changes");

    expect([rem(box(link).height - box(history).height), rem(box(link).top - box(history).bottom) - rem(box(history).top - box(changes).bottom), rem(box(link).left - box(history).left),
      rem(box(link).right - box(history).right), rem(box(link?.querySelector(".ms") ?? null).left - box(history?.querySelector(".ms") ?? null).left),
      rem(box(link?.querySelector(".grow") ?? null).left - box(history?.querySelector(".grow") ?? null).left)]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it.each(AppearanceFixture.modes)("ends a remote branch's counts at a local branch's counts' end, at the same height in its row, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync({
      "git.branches": GitFixtures.branches("main", ["feature", "main"], ["origin/main"], [new GitBranchTrack("feature", 3, 0)]).toJson(),
      "git.remoteTracks": { tracks: [{ branch: "origin/main", ahead: 2, behind: 0 }] }
    });
    [...element.querySelectorAll<HTMLElement>("button.toggle")].find(t => t.textContent?.includes("Remotes"))?.click();
    await untilAsync(() => !Object.isNull(element.querySelector("[title='origin/']")));
    element.querySelector<HTMLElement>("[title='origin/']")?.click();
    await untilAsync(() => !Object.isNull(element.querySelector("[title='origin/main'] .small")));
    const localRow: HTMLElement | null = element.querySelector("button[title=feature]");
    const remoteRow: HTMLElement | null = element.querySelector("[title='origin/main']");
    const local: Element | null = localRow?.querySelector(".small") ?? null;
    const remote: Element | null = remoteRow?.querySelector(".small") ?? null;

    expect([local?.textContent?.trim(), remote?.textContent?.trim()]).toEqual(["↑3", "↑2"]);
    expect(rem(box(remote).right - box(local).right)).toBe(0);
    expect(rem(box(remoteRow).right - box(localRow).right)).toBe(0);
    expect(rem((box(remote).top - box(remoteRow).top) - (box(local).top - box(localRow).top))).toBe(0);
  });

  it.each(AppearanceFixture.modes)("draws a remote branch's Switch to branch over its row's end on the row's fill when it is hovered or focused, its glyph where the counts end and the counts kept where they rest, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const element: HTMLElement = await renderAsync({
        "git.branches": GitFixtures.branches("main", ["feature", "main"], ["origin/next"]).toJson(),
        "git.remoteTracks": { tracks: [{ branch: "origin/next", ahead: 2, behind: 1 }] }
      });
      [...element.querySelectorAll<HTMLElement>("button.toggle")].find(t => t.textContent?.includes("Remotes"))?.click();
      await untilAsync(() => !Object.isNull(element.querySelector("[title='origin/']")));
      element.querySelector<HTMLElement>("[title='origin/']")?.click();
      await untilAsync(() => !Object.isNull(element.querySelector(".remote .count.behind")));
      const wrap: HTMLElement = element.querySelector<HTMLElement>(".remote") ?? element;
      const row: HTMLElement = wrap.querySelector<HTMLElement>(".row") ?? wrap;
      const actions: HTMLElement = wrap.querySelector<HTMLElement>(".actions") ?? wrap;
      const ends = (): number[] => [".count.ahead", ".count.behind"].map(t => rem(box(row.querySelector(t)).right));
      const shown = (): readonly string[] => [getComputedStyle(actions).display, getComputedStyle(actions).backgroundColor, getComputedStyle(row).backgroundColor];
      const rest: number[] = ends();
      const atRest: string = getComputedStyle(actions).display;
      const end: number = RightEdge.endOf(row.querySelector(".count.behind") ?? row);

      row.focus();
      const focused: readonly unknown[] = [ends(), ...shown()];
      row.blur();
      await PointerFixture.hoverAsync(row);
      const hovered: readonly unknown[] = [ends(), ...shown()];
      const missed: readonly string[] = RightEdge.missesOf(wrap, end, [".switch"]);
      await page.screenshot({ element, path: `${screenshots}/git-repository-remote-switch-${mode}.png` });
      row.click();
      await untilAsync(() => row.classList.contains("sel"));
      const selected: readonly string[] = shown();

      expect(atRest).toBe("none");
      expect([focused[0], hovered[0], focused[1], hovered[1]]).toEqual([rest, rest, "flex", "flex"]);
      expect([focused[2], hovered[2]]).toEqual([focused[3], hovered[3]]);
      expect(focused[2]).not.toBe("rgba(0, 0, 0, 0)");
      expect(selected[1]).toBe(selected[2]);
      expect(selected[1]).not.toBe(hovered[2]);
      expect(missed).toEqual([]);
    });

  it.each(AppearanceFixture.modes)("marks History across the panel's row, in the kit's selected fill, once a click on it selects the newest commit, in %s mode", async mode => {
    onTestFinished(() => {
      GitViewing.branch.set(null);
      GitViewing.showChanges(GitFixtures.folder);
    });
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync();
    const history: ComponentFixture<GitHistoryComponent> = TestBed.createComponent(GitHistoryComponent);
    history.componentRef.setInput("instance", GitFixtures.folder);
    history.autoDetectChanges();
    const historyElement: HTMLElement = history.nativeElement;
    historyElement.style.display = "block";
    historyElement.style.height = "10rem";
    document.body.prepend(element);
    onTestFinished(() => element.remove());
    const row: HTMLElement | null = element.querySelector<HTMLElement>("button.row.history");
    const changes: HTMLElement | null = element.querySelector<HTMLElement>("button.row.changes");
    await Wait.until(() => Object.isNull(GitViewing.branch()) && !Object.isNull(historyElement.querySelector("[role=option]")));
    const probe: HTMLElement = document.createElement("div");
    probe.style.background = "var(--nol-selected)";
    element.append(probe);
    onTestFinished(() => probe.remove());

    row?.click();
    await Wait.until(() => row?.classList.contains("sel") === true);
    await page.screenshot({ element, path: `${screenshots}/git-repository-history-${mode}.png` });

    expect([getComputedStyle(row ?? element).backgroundColor, getComputedStyle(changes ?? element).backgroundColor === getComputedStyle(row ?? element).backgroundColor])
      .toEqual([getComputedStyle(probe).backgroundColor, false]);
    expect([rem(box(row).height), rem(box(row).left - box(changes).left), rem(box(row).width - box(changes).width)])
      .toEqual([1.625, 0, 0]);
    expect(rem(box(row?.querySelector(".ms") ?? null).left - box(changes?.querySelector(".ms") ?? null).left)).toBe(0);
  });
});
