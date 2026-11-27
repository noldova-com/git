/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { FileState, GitRemote, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitWorkspaceComponent } from "../../../../src/app/components/git-workspace/git-workspace.component.ts";
import { GitWorkspaceAcrossViewComponent } from "../../../../src/app/components/git-workspace-across-view/git-workspace-across-view.component.ts";
import { GitWorkspacesComponent } from "../../../../src/app/components/git-workspaces/git-workspaces.component.ts";
import { GitPullRequestState } from "../../../../src/app/enums/git-pull-request-state.ts";
import { GitBranchPullRequest } from "../../../../src/app/models/git-branch-pull-request.ts";
import { GitPullRequestRow } from "../../../../src/app/models/git-pull-request-row.ts";
import type { GitWorkspace } from "../../../../src/app/models/git-workspace.ts";
import { GitPullRequests } from "../../../../src/app/services/git-pull-requests.ts";
import { GitRecentRepositories } from "../../../../src/app/services/git-recent-repositories.ts";
import { GitWorkspaces } from "../../../../src/app/services/git-workspaces.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitLayout } from "../../../fixtures/git-layout.fixture.ts";

class WorkspaceScreens {
  public readonly page: HTMLElement;
  public readonly view: HTMLElement;
  public readonly side: HTMLElement;

  public constructor(page: HTMLElement, view: HTMLElement, side: HTMLElement) {
    this.page = page;
    this.view = view;
    this.side = side;
  }
}

describe("GitWorkspaceComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();
  const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/site", RemoteTransport.Https);

  const resolve = (color: string): string => {
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style.color = color;
    document.body.append(probe);
    const resolved: string = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  };

  const textBox = (element: Element): DOMRect => {
    const range: Range = document.createRange();
    const text: Node | undefined = [...element.childNodes].find(t => t.nodeType === Node.TEXT_NODE && (t.textContent ?? "").trim().length > 0);
    if (Object.isUndefined(text))
      return new DOMRect();
    range.selectNodeContents(text);
    return range.getBoundingClientRect();
  };

  const pull = (number: number, passed: number, failing: number, pending: number, isDraft: boolean = false): GitPullRequestRow =>
    new GitPullRequestRow(String(number), `#${number}`, `Change ${number}`, `https://github.com/example-owner/site/pull/${number}`, isDraft, 1, passed, failing, pending, "branch");

  const repositories = [
    ["/work/git", "feature/kit-0.0.25", 3, 0, 3, GitBranchPullRequest.of(pull(214, 3, 0, 0), GitPullRequestState.Open, false)],
    ["/work/ui-components", "feature/kit-0.0.25", 1, 2, 1, GitBranchPullRequest.of(pull(1046, 2, 1, 0, true), GitPullRequestState.Draft, false)],
    ["/work/desktop", "main", 0, 4, 0, GitBranchPullRequest.of(pull(533, 4, 0, 0), GitPullRequestState.Open, true)],
    ["/work/terminal", "feature/kit-0.0.25", 2, 0, 0, GitBranchPullRequest.none(1, 0, 2)],
    ["/work/tools", "main", 0, 0, 0, GitBranchPullRequest.none(0, 0, 0)],
    ["/work/website-noldova", "main", 0, 0, 0, GitBranchPullRequest.of(pull(22, 5, 0, 0), GitPullRequestState.Merged, false)]
  ] as const;

  async function renderAsync(): Promise<HTMLElement> {
    return (await renderBothAsync()).page;
  }

  async function renderBothAsync(): Promise<WorkspaceScreens> {
    await page.viewport(1440, 900);
    localStorage.clear();
    GitWorkspaces.restore();
    GitRecentRepositories.restore();
    onTestFinished(async () => {
      localStorage.clear();
      GitWorkspaces.restore();
      GitRecentRepositories.restore();
      await page.viewport(1280, 800);
    });
    const workspace: GitWorkspace = GitWorkspaces.create("Noldova");
    for (const [folder] of repositories)
      GitWorkspaces.addFolder(workspace.id, folder);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("requestAsync", async (method, params) => {
      const folder: string = JsonReader.fromValue(params).readString("folder");
      const repository: (typeof repositories)[number] | undefined = repositories.find(t => t[0] === folder);
      if (method === "git.pull")
        return null;
      if (method !== "git.status" || Object.isUndefined(repository))
        return GitFixtures.answerFor(GitFixtures.watching, method);
      const [, branch, ahead, behind, files] = repository;
      const status: JsonValue = GitFixtures.status(Array.from({ length: files }, (_, i) => GitFixtures.entry(`f${i}.ts`, FileState.Unmodified, FileState.Modified)),
        new StatusUpstream(`origin/${branch}`, ahead, behind, false), { branch, remote }).toJson();
      return status;
    });
    context.allow("openDocument");
    context.allow("updateDocument");
    context.allow("closeDocument");
    GitFixtures.setUp(context);
    onTestFinished(GitPullRequests.provide(context, {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "github.account", listFor: () => signal(null), refresh: () => undefined,
      branchFor: folder => signal(repositories.find(t => t[0] === folder)?.[5] ?? null), refreshBranch: () => undefined
    }));
    const fixture: ComponentFixture<GitWorkspaceComponent> = TestBed.createComponent(GitWorkspaceComponent);
    fixture.componentRef.setInput("instance", workspace.id);
    const element: HTMLElement = fixture.nativeElement;
    element.style.width = "90rem";
    element.style.height = "24rem";
    fixture.autoDetectChanges();
    const view: ComponentFixture<GitWorkspaceAcrossViewComponent> = TestBed.createComponent(GitWorkspaceAcrossViewComponent);
    view.componentRef.setInput("instance", "selected");
    const viewElement: HTMLElement = view.nativeElement;
    viewElement.style.width = "60rem";
    viewElement.style.height = "24rem";
    view.autoDetectChanges();
    const side: ComponentFixture<GitWorkspacesComponent> = TestBed.createComponent(GitWorkspacesComponent);
    const sideElement: HTMLElement = side.nativeElement;
    sideElement.style.width = "15rem";
    sideElement.style.height = "24rem";
    side.autoDetectChanges();
    document.body.append(element, viewElement);
    await new Promise<void>(resolve => {
      const check = (): void => {
        if ([...element.querySelectorAll(".checks")].filter(t => (t.textContent ?? "").trim().length > 0).length < repositories.length)
          return;
        observer.disconnect();
        resolve();
      };
      const observer: MutationObserver = new MutationObserver(check);
      observer.observe(element, { characterData: true, childList: true, subtree: true });
      check();
    });
    return new WorkspaceScreens(element, viewElement, sideElement);
  }

  const untilAsync = (root: Node, done: () => boolean): Promise<void> => new Promise<void>(resolve => {
    const check = (): void => {
      if (!done())
        return;
      observer.disconnect();
      resolve();
    };
    const observer: MutationObserver = new MutationObserver(check);
    observer.observe(root, { attributes: true, characterData: true, childList: true, subtree: true });
    check();
  });

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      AppearanceFixture.reset();
    }
  });

  it.each(AppearanceFixture.modes)("shows each branch's pull request in the row's text and its checks behind a 0.5rem dot in the state's colour, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync();

    const rows: HTMLElement[] = [...element.querySelectorAll<HTMLElement>(".tr:not(.th)")];
    const pullRequests: HTMLElement[] = rows.map(t => t.querySelector<HTMLElement>(".pull-request") ?? t);
    const checks: HTMLElement[] = rows.map(t => t.querySelector<HTMLElement>(".checks") ?? t);
    const dots: HTMLElement[] = checks.map(t => t.querySelector<HTMLElement>(".dot") ?? t);
    const changes: HTMLElement = rows[0]?.querySelector<HTMLElement>(".changes") ?? element;

    expect(pullRequests.map(t => t.innerText.trim())).toEqual(["#214 open", "#1046 draft", "Review #533", "None", "None", "#22 merged"]);
    expect(checks.map(t => t.innerText.trim())).toEqual(["Passing", "Failing", "Passing", "Running", "None", "Passing"]);
    expect(dots.map(t => getComputedStyle(t).backgroundColor)).toEqual(["--nol-status-ok", "--nol-status-failed", "--nol-status-ok", "--nol-warning", "--nol-text-muted",
      "--nol-status-ok"].map(t => resolve(`var(${t})`)));
    expect(dots.map(t => [rem(box(t).width), rem(box(t).height), getComputedStyle(t).borderTopLeftRadius])).toEqual(dots.map(() => [0.5, 0.5, "50%"]));
    expect(checks.map((t, i) => [rem(box(dots[i] ?? t).left - box(t).left), rem(textBox(t).left - box(dots[i] ?? t).right),
      rem((box(dots[i] ?? t).top + box(dots[i] ?? t).bottom - box(t).top - box(t).bottom) / 2)])).toEqual(checks.map(() => [0, 0.25, 0]));
    expect(pullRequests.map(t => {
      const link: HTMLElement = t.querySelector<HTMLElement>(".link") ?? t;
      return [rem(box(link).left - box(t).left), getComputedStyle(link).color, getComputedStyle(link).fontSize, getComputedStyle(link).fontWeight];
    })).toEqual(pullRequests.map(() => [0, getComputedStyle(changes).color, "12px", getComputedStyle(changes).fontWeight]));
    expect([rem(box(pullRequests[0] ?? element).width), rem(box(checks[0] ?? element).width), ...rows.map(t => rem(box(t).height))])
      .toEqual([8.5, 5, ...rows.map(() => 2)]);

    await page.screenshot({ element, path: `${screenshots}/git-workspace-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("draws the Across repositories document across the middle's 60rem with no background of its own, its change card raised 0.75rem in, and its rows' icons in their states' colours, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const { page: element, view: panel } = await renderBothAsync();
      await untilAsync(panel, () => !Object.isNull(panel.querySelector(".across .behind")));

      const card: HTMLElement = panel.querySelector<HTMLElement>(".change") ?? panel;
      const across: HTMLElement = panel.querySelector<HTMLElement>("nol-git-workspace-across") ?? panel;
      const failing: HTMLElement = panel.querySelector<HTMLElement>(".failing .material-symbols-rounded") ?? panel;
      const behind: HTMLElement = panel.querySelector<HTMLElement>(".behind .material-symbols-rounded") ?? panel;
      const rows: HTMLElement[] = [...panel.querySelectorAll<HTMLElement>(".needs .row")];

      expect([element.querySelectorAll("nol-git-workspace-across").length, rem(box(across).width), rem(box(card).left - box(panel).left), rem(box(card).top - box(panel).top),
        rem(box(panel).right - box(card).right), panel.scrollWidth <= panel.clientWidth]).toEqual([0, 60, 0.75, 0.75, 0.75, true]);
      expect([getComputedStyle(card).backgroundColor, getComputedStyle(card).borderTopColor, getComputedStyle(card).borderTopLeftRadius, getComputedStyle(panel).backgroundColor])
        .toEqual([resolve("var(--nol-raised)"), resolve("var(--nol-card-border)"), "6px", "rgba(0, 0, 0, 0)"]);
      expect([getComputedStyle(failing).color, getComputedStyle(behind).color]).toEqual([resolve("var(--nol-status-failed)"), resolve("var(--nol-icon-color)")]);
      expect(rows.map(t => rem(box(t).height))).toEqual(rows.map(() => 1.625));
      expect(rows.map(t => t.innerText.replace(/\s+/gu, " ").trim())).toEqual(["error ui-components feature/kit-0.0.25: one check failing Open",
        "sync_problem One repository is behind and can fast-forward Pull 1"]);

      await page.screenshot({ element: panel, path: `${screenshots}/git-workspace-across-${mode}.png` });
    });

  it.each(AppearanceFixture.modes)("lays the Workspaces view's views and hosts out as its workspace rows, with 1rem count badges and 0.5rem host dots, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const { side: element } = await renderBothAsync();
    const side: HTMLElement = element.querySelector<HTMLElement>(".side") ?? element;
    const workspace: HTMLElement = side.querySelector<HTMLElement>(".workspace") ?? side;
    const views: HTMLElement[] = [...side.querySelectorAll<HTMLElement>(".view")];
    const badges: HTMLElement[] = [...side.querySelectorAll<HTMLElement>(".view .badge")];
    const sections: HTMLElement[] = [...side.querySelectorAll<HTMLElement>(".section")];
    const host: HTMLElement = side.querySelector<HTMLElement>(".host") ?? side;
    const dot: HTMLElement = host.querySelector<HTMLElement>(".dot") ?? host;
    const detail: HTMLElement = host.querySelector<HTMLElement>(".small") ?? host;
    const icon = (row: HTMLElement): HTMLElement => row.querySelector<HTMLElement>(".material-symbols-rounded") ?? row;

    expect(views.map(t => t.innerText.replace(/\s+/gu, " ").trim())).toEqual(["sync_problem Behind their upstream 2", "edit_note With uncommitted changes 2",
      "rate_review Waiting for review 1", "smart_toy Agents at work"]);
    expect([...views, host].map(t => [rem(box(t).height), rem(box(t).left - box(workspace).left), rem(box(t).width - box(workspace).width)]))
      .toEqual([...views, host].map(() => [1.625, 0, 0]));
    expect(views.map(t => [rem(box(icon(t)).left - box(t).left), rem(box(icon(t)).width)])).toEqual(views.map(() => [0.5, 1]));
    expect(badges.map(t => [rem(box(t).height), rem(box(t).width) >= 1, rem(box(t.parentElement ?? t).right - box(t).right),
      rem((box(t).top + box(t).bottom - box(t.parentElement ?? t).top - box(t.parentElement ?? t).bottom) / 2), getComputedStyle(t).backgroundColor, getComputedStyle(t).color,
      getComputedStyle(t).fontSize])).toEqual(badges.map(() => [1, true, 0.5, 0, resolve("var(--nol-badge)"), resolve("var(--nol-badge-text)"), "11px"]));
    expect(sections.map(t => [(t.querySelector<HTMLElement>(".caps") ?? t).innerText.trim(), rem(box(t).top - box(t.previousElementSibling ?? t).bottom), rem(box(t).height)]))
      .toEqual([["WORKSPACES", 0.625, 1.625], ["VIEWS", 0.625, 1.625], ["HOSTS", 0.625, 1.625]]);
    expect([host.innerText.replace(/\s+/gu, " ").trim(), rem(box(dot).width), rem(box(dot).height), rem(box(dot).left - box(host).left), getComputedStyle(dot).backgroundColor,
      getComputedStyle(detail).color, getComputedStyle(detail).fontSize, rem(box(host).right - box(detail).right)])
      .toEqual(["GitHub signed in", 0.5, 0.5, 0.5, resolve("var(--nol-status-ok)"), resolve("var(--nol-text-muted)"), "12px", 0.5]);
    expect(side.scrollHeight).toBe(side.clientHeight);

    await page.screenshot({ element: side, path: `${screenshots}/git-workspace-side-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("lines the toolbar's Pull and New branch up with Fetch all, the result under it and the branch dialog's field with its text, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync();
    for (const row of [2, 3, 5])
      element.querySelector<HTMLElement>(`.tr:not(.th):nth-child(${row + 1}) nol-checkbox input`)?.click();
    await untilAsync(element, () => !Object.isNull(element.querySelector(".new-branch")));
    const toolbar: HTMLElement = element.querySelector<HTMLElement>(".toolbar") ?? element;
    const buttons: HTMLElement[] = [".fetch-all", ".pull-chosen", ".new-branch"].map(t => toolbar.querySelector<HTMLElement>(t) ?? toolbar);
    const labels: readonly string[] = buttons.map(t => t.innerText.replace(/\s+/gu, " ").trim());
    const layout: readonly (readonly number[])[] = buttons.map((t, i) => [rem(box(t).height), rem(box(t).top - box(buttons[0] ?? t).top),
      i === 0 ? 0.25 : rem(box(t).left - box(buttons[i - 1] ?? t).right)]);

    buttons[1]?.click();
    await untilAsync(element, () => !Object.isNull(element.querySelector(".result p")));
    const result: HTMLElement = element.querySelector<HTMLElement>(".result") ?? element;
    const line: HTMLElement = result.querySelector<HTMLElement>("p") ?? result;
    const table: HTMLElement = element.querySelector<HTMLElement>(".table") ?? element;
    const strip: readonly unknown[] = [line.innerText.trim(), rem(box(result).top - box(toolbar).bottom), rem(box(table).top - box(result).bottom),
      rem(textBox(line).left - box(result).left), rem(box(result).height - box(line).height), getComputedStyle(result).borderBottomColor, getComputedStyle(line).fontSize];
    await page.screenshot({ element: toolbar.parentElement ?? toolbar, path: `${screenshots}/git-workspace-toolbar-${mode}.png` });

    buttons[2]?.click();
    TestBed.inject(ApplicationRef).tick();
    await untilAsync(document.documentElement, () => !Object.isNull(document.querySelector("nol-git-bulk-branch-dialog .name")));
    const dialog: HTMLElement = document.querySelector<HTMLElement>("nol-git-bulk-branch-dialog") ?? document.body;
    const field: HTMLInputElement = dialog.querySelector<HTMLInputElement>(".name") ?? document.createElement("input");
    field.value = "a..b";
    field.dispatchEvent(new Event("input"));
    TestBed.inject(ApplicationRef).tick();
    await untilAsync(dialog, () => !Object.isNull(dialog.querySelector(".refused")));
    const refused: HTMLElement = dialog.querySelector<HTMLElement>(".refused") ?? dialog;
    const text: HTMLElement = dialog.querySelector<HTMLElement>(".text") ?? dialog;
    const item: HTMLElement = dialog.querySelector<HTMLElement>("li") ?? dialog;
    const surface: HTMLElement = dialog.querySelector<HTMLElement>("nol-dialog") ?? dialog;

    expect([labels, layout]).toEqual([["download Fetch all", "arrow_downward Pull 1", "call_split New branch in 3"], buttons.map(() => [rem(box(buttons[0] ?? toolbar).height), 0, 0.25])]);
    expect(strip).toEqual(["Pulled desktop.", 0, 0, 0.75, 0.813, resolve("var(--nol-border)"), "12px"]);
    expect([rem(box(field).left - box(text).left), rem(box(field).width - box(text).width), rem(box(refused).left - box(field).left), rem(box(refused).top - box(field).bottom),
      rem(box(text).top - box(refused).bottom), rem(box(item).left - box(text).left), getComputedStyle(refused).color, field.getAttribute("aria-invalid")])
      .toEqual([0, 0, 0, 0.25, 0.75, 1.25, resolve("var(--nol-error)"), "true"]);

    await page.screenshot({ element: surface, path: `${screenshots}/git-workspace-branch-dialog-${mode}.png` });
    dialog.querySelector<HTMLElement>(".cancel")?.click();
  });

  it.each(AppearanceFixture.modes)("gives the branch at least 8rem at the design's 1440px width with no sideways scroll, fits the narrowed columns' widest usual text and cuts longer text with an ellipsis under the whole text, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync();
    const table: HTMLElement = element.querySelector<HTMLElement>(".table") ?? element;
    const row: HTMLElement = table.querySelector<HTMLElement>(".tr:not(.th)") ?? element;
    const cut: readonly HTMLElement[] = [".name-cell", ".branch .ellipsis", ".pull-request .link"].map(t => row.querySelector<HTMLElement>(t) ?? row);
    const widest = [[".name-cell", "website-noldova"], [".sync", "↑12 ↓3"], [".sync", "Upstream gone"], [".changes", "12 conflicts"],
      [".pull-request .link", "#215 open · on #214"], [".fetched", "12 min ago"]] as const;

    expect([rem(box(row.children[2] ?? row).width) >= 8, table.scrollWidth - table.clientWidth]).toEqual([true, 0]);
    const titleOf = (t: HTMLElement): string => t.matches(".pull-request .link") ? t.querySelector<HTMLElement>(":scope > span")?.title ?? "" : t.title;
    expect(cut.map(t => [getComputedStyle(t).textOverflow, titleOf(t).startsWith((t.textContent ?? "").trim())])).toEqual(cut.map(() => ["ellipsis", true]));
    expect(widest.map(([selector, text]) => {
      const cell: HTMLElement = row.querySelector<HTMLElement>(selector) ?? row;
      cell.textContent = text;
      return [text, rem(cell.scrollWidth - cell.clientWidth)];
    })).toEqual(widest.map(([, text]) => [text, 0]));
  });

  it.each(AppearanceFixture.modes)("fits the app's narrowest window, 640 by 480 less the title bar and margins, the table at full width, flush with the pane and with no card border of its own, its toolbar wrapping, with nothing clipped, outside it or overlapping, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const element: HTMLElement = await renderAsync();
      element.style.width = "39.5rem";
      element.style.height = "27rem";
      const main: DOMRect = box(element.querySelector("main"));
      const toolbar: DOMRect = box(element.querySelector(".toolbar"));
      const filter: DOMRect = box(element.querySelector(".filter"));

      await page.screenshot({ element, path: `${screenshots}/git-workspace-narrow-${mode}.png` });
      expect(GitLayout.problemsOf(element).filter(t => !t.startsWith("scrolls sideways: div.table "))).toEqual([]);
      const panel: CSSStyleDeclaration = getComputedStyle(element.querySelector("main") ?? element);
      expect([rem(main.width), rem(main.height), rem(main.left - box(element).left), rem(main.top - box(element).top), rem(toolbar.height) > 2.25])
        .toEqual([rem(box(element).width), rem(box(element).height), 0, 0, true]);
      expect([panel.borderTopWidth, panel.borderLeftWidth, panel.borderTopLeftRadius, panel.backgroundColor]).toEqual(["0px", "0px", "0px", resolve("var(--nol-panel)")]);
      expect([filter.bottom <= toolbar.bottom, rem(box(element.querySelector(".table")).top - toolbar.bottom)]).toEqual([true, 0]);
    });

  it.each(AppearanceFixture.modes)("keeps every row's Checks and Fetched whole in a 30rem middle, dropping the pull request, changes and sync columns from the header and the rows first, with no sideways scroll, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const element: HTMLElement = await renderAsync();
      element.style.width = "30rem";
      element.style.height = "40rem";
      const main: HTMLElement = element.querySelector<HTMLElement>("main") ?? element;
      const table: HTMLElement = element.querySelector<HTMLElement>(".table") ?? element;
      const rows: readonly HTMLElement[] = [...table.querySelectorAll<HTMLElement>(".tr:not(.th)")];
      const header: HTMLElement = table.querySelector<HTMLElement>(".th") ?? table;
      const shown = (row: HTMLElement): readonly string[] => [...row.children].filter(t => getComputedStyle(t).display !== "none").map(t => (t.textContent ?? "").trim());
      const lefts = (row: HTMLElement): readonly number[] => [...row.children].filter(t => getComputedStyle(t).display !== "none").map(t => rem(box(t).left));

      await page.screenshot({ element: main, path: `${screenshots}/git-workspace-30rem-${mode}.png` });
      expect(GitLayout.problemsOf(main)).toEqual([]);
      expect(table.scrollWidth - table.clientWidth).toBe(0);
      expect(shown(header)).toEqual(["Select", "Repository", "Branch", "Checks", "Fetched"]);
      expect(rows.map(t => [".checks", ".fetched"].map(c => {
        const cell: DOMRect = box(t.querySelector(c));
        return [cell.width > 0, cell.left >= box(table).left, cell.right <= box(table).right];
      }))).toEqual(rows.map(() => [[true, true, true], [true, true, true]]));
      expect(rows.map(t => lefts(t))).toEqual(rows.map(() => lefts(header)));
      expect(rows.map(t => rem(box(t.querySelector(".branch")).width) >= 6)).toEqual(rows.map(() => true));
    });

  it.each(AppearanceFixture.modes)("fits the whole page in a 30rem middle, its toolbar wrapping, with nothing cut, outside it or overlapping and no sideways scroll, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const element: HTMLElement = await renderAsync();
      element.style.width = "30rem";
      element.style.height = "40rem";

      await page.screenshot({ element, path: `${screenshots}/git-workspace-page-30rem-${mode}.png` });
      expect([GitLayout.problemsOf(element), element.scrollWidth <= element.clientWidth]).toEqual([[], true]);
    });

  it.each(AppearanceFixture.modes)("keeps each row's repository, the header's too, at the table's left with the rows' inset while the rows and header scroll sideways under it, its fill clear of the checkboxes before, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const element: HTMLElement = await renderAsync();
    element.style.width = "26rem";
    element.style.height = "27rem";
    const table: HTMLElement = element.querySelector<HTMLElement>(".table") ?? element;
    const rows: readonly HTMLElement[] = [...table.querySelectorAll<HTMLElement>(".tr")];
    const checked: readonly HTMLElement[] = rows.filter(t => !Object.isNull(t.querySelector(".select")));
    const left: number = box(table).left;
    const inset: number = rem(box(table.querySelector(".select")).left - left);
    const clear: readonly number[] = checked.map(t => rem(box(t.children[1] ?? t).left - box(t.querySelector(".select .nol-checkbox-control")).right));
    const start = (cell: Element): number => Object.isNull(cell.firstElementChild) ? textBox(cell).left : box(cell.firstElementChild).left;
    const before: readonly number[] = rows.map(t => box(t.children[2] ?? t).left);

    table.scrollLeft = table.scrollWidth;

    expect(table.scrollLeft).toBeGreaterThan(0);
    expect([inset, clear]).toEqual([0.75, checked.map(() => 0)]);
    expect(rows.map(t => [rem(box(t.children[1] ?? t).left - left), rem(start(t.children[1] ?? t) - left)])).toEqual(rows.map(() => [0, 0.75]));
    expect(rows.map((t, i) => rem((before[i] ?? 0) - box(t.children[2] ?? t).left))).toEqual(rows.map(() => rem(table.scrollLeft)));
    expect(rows.map(t => getComputedStyle(t.children[1] ?? t).backgroundColor)).not.toContain("rgba(0, 0, 0, 0)");
    await page.screenshot({ element, path: `${screenshots}/git-workspace-narrow-scrolled-${mode}.png` });
  });
});
