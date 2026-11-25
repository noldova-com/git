/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { ConflictKind, FailureCode, FileState, GitBranches, GitRemote, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitVisibleDirective } from "../../../../src/app/components/git-workspace/git-visible.directive.ts";
import { GitWorkspaceComponent } from "../../../../src/app/components/git-workspace/git-workspace.component.ts";
import { GitWorkspaceAcrossViewComponent } from "../../../../src/app/components/git-workspace-across-view/git-workspace-across-view.component.ts";
import { GitWorkspacesComponent } from "../../../../src/app/components/git-workspaces/git-workspaces.component.ts";
import { GitAgentState } from "../../../../src/app/enums/git-agent-state.ts";
import { GitPullRequestState } from "../../../../src/app/enums/git-pull-request-state.ts";
import { GitAgentRow } from "../../../../src/app/models/git-agent-row.ts";
import { GitBranchPullRequest } from "../../../../src/app/models/git-branch-pull-request.ts";
import { GitPullRequestList } from "../../../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../../../src/app/models/git-pull-request-row.ts";
import type { GitWorkspace } from "../../../../src/app/models/git-workspace.ts";
import { GitAgents } from "../../../../src/app/services/git-agents.ts";
import { GitPullRequests } from "../../../../src/app/services/git-pull-requests.ts";
import { GitRecentRepositories } from "../../../../src/app/services/git-recent-repositories.ts";
import { GitWorkspaces } from "../../../../src/app/services/git-workspaces.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";

describe("GitWorkspaceComponent", () => {
  const statusOf = (branch: string, ahead: number, behind: number, files: number): JsonValue => GitFixtures.status(
    Array.from({ length: files }, (_, i) => GitFixtures.entry(`f${i}.ts`, FileState.Unmodified, FileState.Modified)),
    new StatusUpstream(`origin/${branch}`, ahead, behind, false), { branch }).toJson();
  const clean: JsonValue = statusOf("main", 0, 0, 0);

  class Screen {
    private static readonly checks: Set<() => void> = new Set();

    public readonly context: FakeWindowPartContext;
    public readonly fixture: ComponentFixture<GitWorkspaceComponent>;
    /** The Across repositories view beside the page, which shows the page's repositories while it is in front. */
    public readonly view: ComponentFixture<GitWorkspaceAcrossViewComponent>;
    /** The Workspaces view in the left dock, which shows the views and hosts of the page in front. */
    public readonly side: ComponentFixture<GitWorkspacesComponent>;
    /** Whether the page is the window's active document. */
    public readonly active: WritableSignal<boolean>;

    public constructor(context: FakeWindowPartContext, fixture: ComponentFixture<GitWorkspaceComponent>, view: ComponentFixture<GitWorkspaceAcrossViewComponent>,
      side: ComponentFixture<GitWorkspacesComponent>, active: WritableSignal<boolean>) {
      this.context = context;
      this.fixture = fixture;
      this.view = view;
      this.side = side;
      this.active = active;
    }

    public get element(): HTMLElement {
      return this.fixture.nativeElement;
    }

    public get viewElement(): HTMLElement {
      return this.view.nativeElement;
    }

    public get sideElement(): HTMLElement {
      return this.side.nativeElement;
    }

    /**
     * Renders the page, answering each folder's status from a map, a clean one for any other, and each fetch once the gate opens; a request named
     * with its folder, such as "git.branches /work/b", answers from the other map, and any other branches read finds only main.
     */
    public static render(instance: string, statuses: Readonly<Record<string, JsonValue | Error>> = {}, gate: Promise<void> = Promise.resolve(),
      answers: Readonly<Record<string, JsonValue | Error>> = {}): Screen {
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      context.answer("requestAsync", async (method, params) => {
        queueMicrotask(() => Screen.checks.forEach(check => check()));
        const folder: string = JsonReader.fromValue(params).readString("folder");
        const named: JsonValue | Error | undefined = answers[`${method} ${folder}`];
        if (named instanceof Error)
          throw named;
        if (named !== undefined)
          return named;
        if (method === "git.fetch")
          await gate;
        if (method === "git.branches")
          return new GitBranches("main", ["main"], [], []).toJson();
        if (method !== "git.status")
          return ["git.fetch", "git.pull", "git.createBranch"].includes(method) ? null : GitFixtures.answerFor(GitFixtures.watching, method);
        const answer: JsonValue | Error = statuses[folder] ?? clean;
        if (answer instanceof Error)
          throw answer;
        return answer;
      });
      context.allow("openDocument");
      context.allow("updateDocument");
      context.allow("closeDocument");
      const active: WritableSignal<boolean> = signal(true);
      GitFixtures.setUp(context, [{ provide: WindowPartTokens.activeDocument, useValue: active }]);
      const fixture: ComponentFixture<GitWorkspaceComponent> = TestBed.createComponent(GitWorkspaceComponent);
      fixture.componentRef.setInput("instance", instance);
      fixture.autoDetectChanges();
      const view: ComponentFixture<GitWorkspaceAcrossViewComponent> = TestBed.createComponent(GitWorkspaceAcrossViewComponent);
      view.componentRef.setInput("instance", "selected");
      view.autoDetectChanges();
      const side: ComponentFixture<GitWorkspacesComponent> = TestBed.createComponent(GitWorkspacesComponent);
      side.autoDetectChanges();
      // TestBed takes the earlier fixtures' root elements out of the page as it creates a component, so the page and the view go back beside the side.
      document.body.append(fixture.nativeElement, view.nativeElement);
      return new Screen(context, fixture, view, side, active);
    }

    /** The matches in the page, then in the Across repositories view, then in the Workspaces view, as the window shows them side by side. */
    public all<T extends Element = Element>(selector: string): readonly T[] {
      return [...this.element.querySelectorAll<T>(selector), ...this.viewElement.querySelectorAll<T>(selector), ...this.sideElement.querySelectorAll<T>(selector)];
    }

    /** Reads an element's text as a person sees it: each piece of text, such as an icon's name and a label, apart. */
    public static textOf(element: Element): string {
      const walker: TreeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const pieces: string[] = [];
      for (let node: Node | null = walker.nextNode(); node !== null; node = walker.nextNode())
        pieces.push((node.textContent ?? "").replace(/\s+/gu, " ").trim());
      return pieces.filter(t => t.length > 0).join(" ");
    }

    public texts(selector: string): readonly string[] {
      return this.all(selector).map(t => Screen.textOf(t));
    }

    public find<T extends HTMLElement = HTMLElement>(selector: string): T {
      const [found] = this.all<T>(selector);
      if (found === undefined)
        throw new Error(`Nothing matches ${selector}.`);
      return found;
    }

    public has(selector: string): boolean {
      return this.all(selector).length > 0;
    }

    /** Clicks the match at an index, counted from 0, or the first. */
    public click(selector: string, index: number = 0): void {
      const found: HTMLElement | undefined = this.all<HTMLElement>(selector)[index];
      if (found === undefined)
        throw new Error(`Nothing matches ${selector} at ${index}.`);
      found.click();
      this.fixture.detectChanges();
      this.view.detectChanges();
      this.side.detectChanges();
    }

    /** Ticks the checkbox of a row, counted from 0 below the header. */
    public select(row: number): void {
      this.click(`.tr:not(.th):nth-child(${row + 2}) nol-checkbox input`);
    }

    public rows(): readonly string[] {
      return [...this.element.querySelectorAll(".tr:not(.th)")].map(row => [...row.children].slice(1)
        .map(t => Screen.textOf(t)).filter(t => t.length > 0).join(" ").replace(/^folder /u, ""));
    }

    public folders(method: string): readonly string[] {
      return this.context.callsOf("requestAsync").filter(t => t[0] === method).map(t => JsonReader.fromValue(t[1]).readString("folder"));
    }

    /** Waits until done holds, checking again on each change to the page and after each request it makes. */
    public untilAsync(done: () => boolean): Promise<void> {
      if (done())
        return Promise.resolve();
      return new Promise(resolve => {
        const check = (): void => {
          if (!done())
            return;
          observer.disconnect();
          Screen.checks.delete(check);
          resolve();
        };
        const observer: MutationObserver = new MutationObserver(check);
        for (const root of [this.element, this.viewElement, this.sideElement])
          observer.observe(root, { attributes: true, characterData: true, childList: true, subtree: true });
        Screen.checks.add(check);
      });
    }
  }

  const fresh = (...folders: string[]): GitWorkspace => {
    localStorage.clear();
    GitWorkspaces.restore();
    GitRecentRepositories.restore();
    onTestFinished(() => {
      localStorage.clear();
      GitWorkspaces.restore();
      GitRecentRepositories.restore();
    });
    const workspace: GitWorkspace = GitWorkspaces.create("Noldova");
    for (const folder of folders)
      GitWorkspaces.addFolder(workspace.id, folder);
    return workspace;
  };

  const rem = (element: Element): { readonly width: number; readonly height: number } => {
    const size: number = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const rect: DOMRect = element.getBoundingClientRect();
    return { width: rect.width / size, height: rect.height / size };
  };

  it("lists a workspace's repositories in its order, each with its branch, sync and changes once its row is on screen", async () => {
    const workspace: GitWorkspace = fresh("/work/git", "/work/desktop", "/work/site");
    GitWorkspaces.create("Websites");
    GitRecentRepositories.remember("/work/app");
    const screen: Screen = Screen.render(workspace.id, {
      "/work/git": statusOf("feature/graph", 3, 0, 3), "/work/desktop": statusOf("main", 0, 4, 0), "/work/site": statusOf("main", 0, 0, 1)
    });

    await screen.untilAsync(() => screen.texts(".sync").filter(t => t.length > 0).length === 3 && screen.folders("git.watch").length === 3);

    expect(screen.rows()).toEqual(["git call_split feature/graph ↑3 3 files None Never", "desktop call_split main ↓4 Clean None Never",
      "site call_split main Up to date 1 file None Never"]);
    expect(screen.texts(".side .workspace, .side .open-repositories")).toEqual(["dashboard Dashboard 1", "workspaces Noldova 3", "workspaces Websites 0"]);
    expect(screen.texts(".side [aria-current=page]")).toEqual(["workspaces Noldova 3"]);
    expect(screen.texts(".toolbar .name, .toolbar .count-text")).toEqual(["Noldova", "3 repositories"]);
    expect(new Set(screen.folders("git.watch"))).toEqual(new Set(["/work/git", "/work/desktop", "/work/site"]));
    expect([...screen.folders("git.status")].sort()).toEqual(["/work/desktop", "/work/git", "/work/site"]);
  });

  it("lays the page out to the design at its 1440px width, the whole width with the workspaces in their own view: a 2.25rem toolbar, 2rem rows and the columns' widths", async () => {
    const workspace: GitWorkspace = fresh("/work/git");
    const screen: Screen = Screen.render(workspace.id);
    screen.element.style.width = "90rem";
    await screen.untilAsync(() => screen.texts(".sync")[0] === "Up to date");
    const row: Element = screen.find(".tr:not(.th)");

    expect(rem(screen.find(".toolbar")).height).toBeCloseTo(2.25, 2);
    expect(rem(row).height).toBeCloseTo(2, 2);
    expect(rem(screen.find(".th")).height).toBeCloseTo(1.75, 2);
    expect(rem(row.children[0] ?? row).width).toBeCloseTo(1.375, 2);
    expect(rem(row.children[1] ?? row).width).toBeCloseTo(8.75, 2);
    expect(rem(row.children[5] ?? row).width).toBeCloseTo(8.5, 2);
    expect(rem(row.children[6] ?? row).width).toBeCloseTo(5, 2);
    expect(rem(row.children[7] ?? row).width).toBeCloseTo(5.5, 2);
    expect(screen.texts(".th [role=columnheader]")).toEqual(["Select", "Repository", "Branch", "Sync", "Changes", "Pull request", "Checks", "Fetched"]);
    expect(rem(screen.find(".side .row")).height).toBeCloseTo(1.625, 2);
    expect(rem(screen.find(".filter")).width).toBeCloseTo(14, 2);
    expect([screen.element.querySelectorAll(".across, aside").length, rem(screen.find("main")).width]).toEqual([0, 89.5]);
  });

  it("opens the Across repositories view once for the page in front with its repositories, keeps them while a document of another kind is, giving the tab back and taking it again, and empties once the page closes",
    async () => {
      const workspace: GitWorkspace = fresh("/work/a", "/work/b");
      const screen: Screen = Screen.render(workspace.id, { "/work/a": statusOf("main", 0, 2, 0) });
      const empty = (): readonly string[] => screen.texts(".empty-view");
      await screen.untilAsync(() => screen.has(".across .behind"));
      const front: readonly string[] = [...empty(), ...screen.texts(".across .behind")];

      screen.active.set(false);
      screen.view.detectChanges();
      const behind: readonly string[] = [...empty(), ...screen.texts(".across .behind")];
      screen.active.set(true);
      screen.view.detectChanges();
      screen.fixture.destroy();
      screen.view.detectChanges();

      const opened: readonly unknown[] = ["git.workspaceAcross", "selected", "Across repositories"];
      expect([front.length, behind, empty(), screen.context.callsOf("openView"), screen.context.callsOf("returnView"), screen.context.callsOf("showView")])
        .toEqual([1, front, ["Open a workspace to see its repositories together here."], [opened, opened], [["git.workspaceAcross", "selected"]], []]);
    });

  it("follows only the rows on screen, stops following a row the filter hides, and reads every listed repository when the window regains focus", async () => {
    const folders: string[] = Array.from({ length: 60 }, (_, i) => `/work/r${i}`);
    const workspace: GitWorkspace = fresh(...folders);
    const screen: Screen = Screen.render(workspace.id);
    await screen.untilAsync(() => screen.folders("git.watch").length > 0 && screen.texts(".sync")[0] === "Up to date");
    const watched: number = new Set(screen.folders("git.watch")).size;

    const filter: HTMLInputElement = screen.find<HTMLInputElement>(".filter input");
    filter.value = "r1";
    filter.dispatchEvent(new Event("input"));
    await screen.untilAsync(() => screen.folders("git.unwatch").length > 0);
    const before: number = screen.folders("git.status").length;
    window.dispatchEvent(new Event("focus"));
    await screen.untilAsync(() => screen.folders("git.status").length >= before + 60);

    expect(watched).toBeGreaterThan(0);
    expect(watched).toBeLessThan(60);
    expect(screen.rows().length).toBe(11);
    expect(screen.folders("git.unwatch")).not.toContain("/work/r1");
  });

  it("shows a failed read in place of the branch and sync, and marks conflicts", async () => {
    const workspace: GitWorkspace = fresh("/work/lost", "/work/merge");
    const conflicted: JsonValue = GitFixtures.status([GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)], null).toJson();
    const screen: Screen = Screen.render(workspace.id, {
      "/work/lost": GitFixtures.failure(FailureCode.NotRepository, null, "The folder isn't a repository."), "/work/merge": conflicted
    });

    await screen.untilAsync(() => screen.has(".failure") && screen.texts(".changes")[1] !== "");

    expect(screen.texts(".failure")).toEqual(["The folder isn't a repository."]);
    expect(screen.has(".changes.conflicts")).toBe(true);
  });

  it("fetches every listed repository, shows each as fetching meanwhile, and keeps Fetch all unavailable until they end", async () => {
    const workspace: GitWorkspace = fresh("/work/a", "/work/b");
    let open: () => void = () => undefined;
    const screen: Screen = Screen.render(workspace.id, {}, new Promise<void>(resolve => {
      open = resolve;
    }));
    await screen.untilAsync(() => screen.texts(".sync").every(t => t === "Up to date") && screen.texts(".sync").length === 2);

    screen.click(".fetch-all");
    await screen.untilAsync(() => screen.texts(".changes").every(t => t === "Fetching…"));
    const during: string | null = screen.find(".fetch-all").getAttribute("aria-disabled");
    open();
    await screen.untilAsync(() => screen.find(".fetch-all").getAttribute("aria-disabled") !== "true");

    expect([during, screen.folders("git.fetch")]).toEqual(["true", ["/work/a", "/work/b"]]);
    expect(screen.texts(".changes")).toEqual(["Clean", "Clean"]);
  });

  it("pulls the chosen repositories only behind their upstream from the toolbar, then says what it pulled and reads them again", async () => {
    const workspace: GitWorkspace = fresh("/work/a", "/work/b", "/work/c", "/work/d");
    const screen: Screen = Screen.render(workspace.id, { "/work/a": statusOf("main", 0, 2, 0), "/work/c": statusOf("main", 0, 1, 0), "/work/d": statusOf("main", 1, 1, 0) });
    await screen.untilAsync(() => screen.texts(".sync").join() === "↓2,Up to date,↓1,↑1 ↓1");
    const hidden: boolean = screen.has(".pull-chosen") || screen.has(".new-branch");
    screen.select(1);
    const alone: readonly unknown[] = [screen.texts(".pull-chosen, .new-branch"), screen.find(".pull-chosen").getAttribute("aria-disabled")];
    screen.select(0);
    screen.select(2);
    screen.select(3);
    const labels: readonly string[] = screen.texts(".pull-chosen, .new-branch");
    const reads: number = screen.folders("git.status").length;

    screen.click(".pull-chosen");
    await screen.untilAsync(() => screen.has(".result") && screen.folders("git.status").length >= reads + 4);

    expect([hidden, alone, labels]).toEqual([false, [["arrow_downward Pull 0", "call_split New branch in 1"], "true"], ["arrow_downward Pull 2", "call_split New branch in 4"]]);
    expect([screen.folders("git.pull"), [...screen.folders("git.status").slice(reads)].sort(), screen.texts(".result p")])
      .toEqual([["/work/a", "/work/c"], ["/work/a", "/work/a", "/work/c", "/work/c"], ["Pulled a and c."]]);
  });

  it("asks for a branch name Git takes before creating it in every chosen repository, skipping one that has it, and says how each ended", async () => {
    const workspace: GitWorkspace = fresh("/work/a", "/work/b", "/work/c");
    const screen: Screen = Screen.render(workspace.id, {}, undefined, {
      "git.branches /work/b": new GitBranches("main", ["main", "feature/kit"], [], []).toJson(),
      "git.createBranch /work/c": GitFixtures.failure(FailureCode.Git, null, "The hook refused it.")
    });
    await screen.untilAsync(() => screen.folders("git.status").length >= 3);
    const dialog = (): HTMLElement | null => document.querySelector("nol-git-bulk-branch-dialog");
    const part = <T extends HTMLElement>(selector: string): T => {
      const found: T | null | undefined = dialog()?.querySelector<T>(selector);
      if (found === null || found === undefined)
        throw new Error(`The dialog has no ${selector}.`);
      return found;
    };
    const textsOf = (selector: string): string[] => [...document.querySelectorAll(selector)].map(t => (t.textContent ?? "").replace(/\s+/gu, " ").trim());
    const openAsync = async (): Promise<void> => {
      screen.click(".new-branch");
      await screen.fixture.whenStable();
    };
    const type = (name: string): void => {
      const field: HTMLInputElement = part<HTMLInputElement>(".name");
      field.value = name;
      field.dispatchEvent(new Event("input"));
      screen.fixture.detectChanges();
    };
    const refusal = (): readonly unknown[] => [part<HTMLButtonElement>(".create").disabled, textsOf("nol-git-bulk-branch-dialog .refused"),
      part(".name").getAttribute("aria-invalid")];

    screen.select(1);
    await openAsync();
    const single: readonly string[] = textsOf("nol-git-bulk-branch-dialog .nol-dialog-title");
    part(".nol-dialog-close").click();
    await screen.fixture.whenStable();
    const closed: HTMLElement | null = dialog();
    screen.select(0);
    screen.select(2);
    await openAsync();
    const asked: readonly unknown[] = [...textsOf("nol-git-bulk-branch-dialog .nol-dialog-title"), ...textsOf("nol-git-bulk-branch-dialog li"),
      document.activeElement === part(".name")];
    const empty: readonly unknown[] = refusal();
    type("a..b");
    const refused: readonly unknown[] = refusal();
    part(".name").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    screen.fixture.detectChanges();
    const kept: boolean = dialog() !== null;
    part(".cancel").click();
    await screen.fixture.whenStable();
    const cancelled: readonly unknown[] = [dialog(), screen.folders("git.branches"), screen.folders("git.createBranch")];
    await openAsync();
    type("feature/kit");
    const taken: readonly unknown[] = refusal();
    part(".name").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await screen.untilAsync(() => screen.texts(".result p").length === 3);

    expect([single, closed]).toEqual([["New branch in one repository"], null]);
    expect(asked).toEqual(["New branch in three repositories", "a", "b", "c", true]);
    expect([empty, refused, kept, cancelled, taken]).toEqual([[true, [], "false"], [true, ["Git doesn't take this as a branch name."], "true"], true, [null, [], []],
      [false, [], "false"]]);
    expect([dialog(), [...screen.folders("git.branches")].sort(), screen.context.callsOf("requestAsync").filter(t => t[0] === "git.createBranch")
      .map(t => JsonReader.fromValue(t[1])).map(t => `${t.readString("folder")} ${t.readString("name")}`).sort()]).toEqual([null, ["/work/a", "/work/b", "/work/c"],
      ["/work/a feature/kit", "/work/c feature/kit"]]);
    expect(screen.texts(".result p")).toEqual(["Created feature/kit in a.", "Skipped b: it already has a branch feature/kit.", "c failed: The hook refused it."]);
  });

  it("adds a chosen repository to the workspace, and nothing when the person cancels", async () => {
    const workspace: GitWorkspace = fresh("/work/a");
    const screen: Screen = Screen.render(workspace.id);
    const chosen: (string | null)[] = [null, "/work/b"];
    screen.context.answer("chooseFolderAsync", async () => chosen.shift() ?? null);

    screen.click(".toolbar .add");
    await screen.fixture.whenStable();
    screen.click(".toolbar .add");
    await screen.untilAsync(() => screen.rows().length === 2);

    expect(GitWorkspaces.find(workspace.id)?.folders).toEqual(["/work/a", "/work/b"]);
  });

  it("moves the selected repositories up and down, and removes them from the workspace", async () => {
    const workspace: GitWorkspace = fresh("/work/a", "/work/b", "/work/c");
    const screen: Screen = Screen.render(workspace.id);

    screen.select(2);
    const count: readonly string[] = screen.texts(".count-text");
    screen.click(".move-up");
    const up: readonly string[] | undefined = GitWorkspaces.find(workspace.id)?.folders;
    screen.click(".move-down");
    const down: readonly string[] | undefined = GitWorkspaces.find(workspace.id)?.folders;
    screen.select(0);
    screen.click(".toolbar .remove");

    expect([count, up, down]).toEqual([["3 repositories · 1 selected"], ["/work/a", "/work/c", "/work/b"], ["/work/a", "/work/b", "/work/c"]]);
    expect([GitWorkspaces.find(workspace.id)?.folders, screen.has(".toolbar .remove")]).toEqual([["/work/b"], false]);
  });

  it("unticks a selected row, which hides the selection's actions", () => {
    const workspace: GitWorkspace = fresh("/work/a");
    const screen: Screen = Screen.render(workspace.id);

    screen.select(0);
    const shown: boolean = screen.has(".toolbar .remove");
    screen.select(0);

    expect([shown, screen.has(".toolbar .remove")]).toEqual([true, false]);
  });

  it("lists the repositories opened lately on the open repositories' page, adds a chosen one there, and forgets the selected ones without moving them", async () => {
    fresh();
    GitRecentRepositories.remember("/work/b");
    GitRecentRepositories.remember("/work/a");
    const screen: Screen = Screen.render("open");
    screen.context.answer("chooseFolderAsync", async () => "/work/c");

    screen.click(".toolbar .add");
    await screen.untilAsync(() => screen.rows().length === 3);
    screen.select(1);
    const actions: boolean[] = [screen.has(".move-up"), screen.has(".rename"), screen.has(".remove-workspace")];
    screen.click(".toolbar .remove");

    expect([screen.texts(".toolbar .name"), actions, GitRecentRepositories.recent()]).toEqual([["Dashboard"], [false, false, false], ["/work/c", "/work/b"]]);
    expect(screen.texts(".side [aria-current=page]")).toEqual(["dashboard Dashboard 2"]);
  });

  it("opens a repository's history from its name, which puts it first among the ones opened lately", () => {
    const workspace: GitWorkspace = fresh("/work/site");
    const screen: Screen = Screen.render(workspace.id);

    screen.click(".name-cell");

    expect([screen.context.callsOf("openDocument"), GitRecentRepositories.recent()]).toEqual([[["git.history", "/work/site", "site"]], ["/work/site"]]);
  });

  it("opens another workspace's page, the open repositories' page, and a new workspace's page from the Workspaces view", () => {
    const workspace: GitWorkspace = fresh();
    const other: GitWorkspace = GitWorkspaces.create("Websites");
    const screen: Screen = Screen.render(workspace.id);

    screen.click(".side .workspace", 1);
    screen.click(".side .open-repositories");
    screen.click(".side .new");
    const made: GitWorkspace | undefined = GitWorkspaces.list().at(-1);

    expect(screen.context.callsOf("openDocument")).toEqual([
      ["git.workspace", other.id, "Websites"], ["git.workspace", "open", "Dashboard"], ["git.workspace", made?.id, "New workspace"]
    ]);
  });

  it("renames the workspace on Enter once, retitling its tab, and keeps the name on Escape, a blank or the same name", async () => {
    const workspace: GitWorkspace = fresh();
    const screen: Screen = Screen.render(workspace.id);
    const typeAsync = async (name: string): Promise<HTMLInputElement> => {
      screen.click(".rename");
      await screen.fixture.whenStable();
      const field: HTMLInputElement = screen.find<HTMLInputElement>(".name-field");
      field.value = name;
      field.dispatchEvent(new Event("input"));
      return field;
    };
    const renameAsync = async (name: string, key: string): Promise<void> => {
      const field: HTMLInputElement = await typeAsync(name);
      field.dispatchEvent(new KeyboardEvent("keydown", { key }));
      field.dispatchEvent(new FocusEvent("blur"));
      screen.fixture.detectChanges();
    };
    await typeAsync("Shown");
    const focused: boolean = document.activeElement === screen.find(".name-field");
    screen.find<HTMLInputElement>(".name-field").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    screen.fixture.detectChanges();

    await renameAsync("Kept", "Escape");
    await renameAsync(" ", "Enter");
    await renameAsync("Noldova", "Enter");
    await renameAsync(" Core ", "Enter");
    await screen.fixture.whenStable();

    expect([focused, GitWorkspaces.find(workspace.id)?.name, screen.texts(".toolbar .name"), screen.has(".name-field")]).toEqual([true, "Core", ["Core"], false]);
    expect(screen.context.callsOf("updateDocument")).toEqual([["git.workspace", workspace.id, { title: "Core" }]]);
  });

  it("opens the name field on the workspace's name, and renames the workspace when the field loses focus", async () => {
    const workspace: GitWorkspace = fresh();
    const screen: Screen = Screen.render(workspace.id);

    screen.click(".rename");
    await screen.fixture.whenStable();
    const field: HTMLInputElement = screen.find<HTMLInputElement>(".name-field");
    const named: string = field.value;
    field.value = "Sites";
    field.dispatchEvent(new Event("input"));
    field.blur();
    screen.fixture.detectChanges();

    expect([named, GitWorkspaces.find(workspace.id)?.name]).toEqual(["Noldova", "Sites"]);
  });

  it("removes the workspace, opening the open repositories' page and closing its own", () => {
    const workspace: GitWorkspace = fresh("/work/a");
    const screen: Screen = Screen.render(workspace.id);

    screen.click(".remove-workspace");

    expect([GitWorkspaces.list(), screen.context.callsOf("openDocument"), screen.context.callsOf("closeDocument")])
      .toEqual([[], [["git.workspace", "open", "Dashboard"]], [["git.workspace", workspace.id]]]);
  });

  it("says when there are no repositories, offering to add one, and when the filter matches none", () => {
    const workspace: GitWorkspace = fresh();
    const screen: Screen = Screen.render(workspace.id);
    const empty: readonly string[] = screen.texts(".empty p, .empty button");
    const unavailable: string | null = screen.find(".fetch-all").getAttribute("aria-disabled");
    GitWorkspaces.addFolder(workspace.id, "/work/a");
    const filter: HTMLInputElement = screen.find<HTMLInputElement>(".filter input");
    filter.value = "zzz";
    filter.dispatchEvent(new Event("input"));
    screen.fixture.detectChanges();

    expect([empty, unavailable, screen.texts(".empty")]).toEqual([["No repositories here yet.", "Add repository…"], "true", ["No repository matches the filter."]]);
  });

  it("stops following every repository when the page closes", async () => {
    const workspace: GitWorkspace = fresh("/work/a");
    const screen: Screen = Screen.render(workspace.id);
    await screen.untilAsync(() => screen.folders("git.watch").length === 1);
    const read: number = screen.folders("git.status").length;

    screen.fixture.destroy();
    window.dispatchEvent(new Event("focus"));

    expect([screen.folders("git.unwatch"), screen.folders("git.status").length]).toEqual([["/work/a"], read]);
  });

  it("follows a row once when it is reported on screen again while followed, so one report off screen stops following it", async () => {
    const workspace: GitWorkspace = fresh("/work/a");
    const screen: Screen = Screen.render(workspace.id);
    await screen.untilAsync(() => screen.folders("git.watch").length === 1);
    const visible: GitVisibleDirective = screen.fixture.debugElement.query(By.directive(GitVisibleDirective)).injector.get(GitVisibleDirective);

    visible.visibleChange.emit(true);
    visible.visibleChange.emit(false);

    expect([screen.folders("git.watch"), screen.folders("git.unwatch")]).toEqual([["/work/a"], ["/work/a"]]);
  });

  it("shows each branch's open pull request and its checks once its row is on screen, reads them again when the window takes the focus, and opens one", async () => {
    const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/site", RemoteTransport.Https);
    const list: WritableSignal<GitPullRequestList | null> = signal(null);
    const pull = (number: number, branch: string, failing: number): GitPullRequestRow => new GitPullRequestRow(String(number), `#${number}`, `Change ${number}`,
      `https://github.com/example-owner/site/pull/${number}`, false, 1, 2, failing, 0, branch);
    const refreshed: string[] = [];
    const waiting: (() => void)[] = [];
    const readAsync = (count: number): Promise<void> => refreshed.length >= count ? Promise.resolve() : new Promise(resolve => {
      waiting[count] = resolve;
    });
    const opened: string[] = [];
    onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "github.account", listFor: () => list,
      refresh: folder => {
        refreshed.push(folder);
        waiting[refreshed.length]?.();
      },
      open: (_folder, row) => {
        opened.push(row.label);
        return opened.length > 1;
      }
    }));
    const workspace: GitWorkspace = fresh("/work/site", "/work/plain");
    const screen: Screen = Screen.render(workspace.id, { "/work/site": GitFixtures.status([], null, { branch: "feature/graph", remote }).toJson() });
    const links: string[] = [];
    screen.context.answer("openLinkAsync", async url => {
      links.push(url);
    });
    await readAsync(1);
    await screen.untilAsync(() => screen.texts(".pull-request")[1] === "None");
    const reading: readonly string[] = screen.texts(".pull-request");

    list.set(GitPullRequestList.ready([pull(9, "main", 0), pull(214, "feature/graph", 1)]));
    await screen.untilAsync(() => screen.texts(".pull-request")[0] === "#214 open");
    window.dispatchEvent(new Event("focus"));
    await readAsync(2);
    screen.click(".pull-request .link");
    screen.click(".pull-request .link");
    screen.click(".across .failing button");
    screen.click(".pull-request .link a");

    expect([reading, screen.texts(".pull-request"), screen.texts(".checks"), screen.find(".checks .dot").className, screen.find(".pull-request .link").title,
      screen.find(".pull-request .link a").getAttribute("href")]).toEqual([["", "None"], ["#214 open", "None"], ["Failing", ""], "dot failed", "#214 open: Change 214",
      "https://github.com/example-owner/site/pull/214"]);
    expect([refreshed, opened, links]).toEqual([["/work/site", "/work/site"], ["#214", "#214", "#214", "#214"], ["https://github.com/example-owner/site/pull/214"]]);
  });

  it("feeds the Across repositories panel every listed repository's held reads and the agents' runs, opens its repositories, and reads again what its pull wrote", async () => {
    const conflicted: JsonValue = GitFixtures.status([GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)], null, { branch: "main" }).toJson();
    const workspace: GitWorkspace = fresh("/work/a", "/work/b", "/work/c");
    onTestFinished(GitAgents.provide({
      listFor: folder => folder === "/work/a" ? signal([new GitAgentRow("r1", "Blame gutter", GitAgentState.Working, "/work/a-blame")]) : signal(null),
      open: () => undefined
    }));
    const screen: Screen = Screen.render(workspace.id, { "/work/a": statusOf("main", 0, 2, 0), "/work/b": conflicted });
    await screen.untilAsync(() => screen.has(".across .behind") && screen.has(".across .conflicted") && screen.folders("git.watch").length === 3);
    const reported: unknown[] = [];
    vi.spyOn(screen.fixture.debugElement.injector.get(ErrorHandler), "handleError").mockImplementation(error => reported.push(error));
    onTestFinished(GitAgents.provide({
      listFor: () => {
        throw new Error("The agents module failed.");
      },
      open: () => undefined
    }));
    screen.fixture.detectChanges();
    const runs: readonly string[] = screen.texts(".across .working .row");

    screen.click(".across .conflicted button");
    const before: number = screen.folders("git.status").length;
    screen.click(".across .behind button");
    await screen.untilAsync(() => screen.has(".across .result") && screen.folders("git.status").length >= before + 2);

    expect(runs).toEqual(["smart_toy a · Blame gutter own worktree"]);
    expect([...new Set(reported.map(t => t instanceof Error ? t.message : ""))]).toEqual(["The agents module failed."]);
    expect(screen.context.callsOf("openDocument").at(-1)).toEqual(["git.history", "/work/b", "b"]);
    expect([screen.folders("git.pull"), screen.folders("git.status").slice(before), screen.texts(".across .result")]).toEqual([["/work/a"], ["/work/a", "/work/a"], ["Pulled a."]]);
  });

  it("shows a branch's pull request stacked on another open one in its host's list, and the stack under Needs you", async () => {
    const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/git", RemoteTransport.Https);
    const pullOf = (number: number, head: string, base: string): GitPullRequestRow =>
      new GitPullRequestRow(String(number), `#${number}`, `Change ${number}`, `https://github.com/example-owner/git/pull/${number}`, false, 0, 0, 0, 0, head, base);
    onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "github.account", refresh: () => undefined,
      listFor: () => signal(GitPullRequestList.ready([pullOf(215, "feature/graph", "feature/graph-base"), pullOf(214, "feature/graph-base", "main")]))
    }));
    const workspace: GitWorkspace = fresh("/work/git");
    const screen: Screen = Screen.render(workspace.id, { "/work/git": GitFixtures.status([], null, { branch: "feature/graph", remote }).toJson() });

    await screen.untilAsync(() => screen.texts(".pull-request")[0] === "#215 open · on #214" && screen.has(".across .stacked"));

    expect(screen.texts(".across .stacked")).toEqual(["stacks git: #214, then #215: merge in order, #214 first Open"]);
  });

  it("finds a stack in the stack list of a host that reads branches, while its cell, checks and review wait come from the branch's read alone", async () => {
    const remote: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https);
    const pullOf = (number: number, head: string, base: string, failing: number): GitPullRequestRow => new GitPullRequestRow(`fabrikam/site/${number}`,
      `!${number}`, `Change ${number}`, `https://dev.azure.com/fabrikam/web/_git/site/pullrequest/${number}`, false, 0, 0, failing, 0, head, base);
    const asked: string[] = [];
    onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
      claims: t => t.host === "dev.azure.com", hostName: "Azure DevOps", signInPage: "git-azure-devops.accounts", refresh: () => undefined,
      listFor: () => {
        asked.push("list");
        return signal(null);
      },
      branchFor: () => signal(GitBranchPullRequest.of(pullOf(215, "feature/graph", "feature/graph-base", 1), GitPullRequestState.Open, true)),
      refreshBranch: () => undefined,
      stackListFor: () => {
        asked.push("stacks");
        return signal(GitPullRequestList.ready([pullOf(215, "feature/graph", "feature/graph-base", 0), pullOf(214, "feature/graph-base", "main", 0)]));
      }
    }));
    const workspace: GitWorkspace = fresh("/work/site");
    const screen: Screen = Screen.render(workspace.id, { "/work/site": GitFixtures.status([], null, { branch: "feature/graph", remote }).toJson() });

    await screen.untilAsync(() => screen.texts(".pull-request")[0] === "Review !215 · on !214" && screen.has(".across .stacked"));

    expect([screen.texts(".checks"), screen.find(".checks .dot").className, screen.texts(".across .stacked"), asked]).toEqual([["Failing"], "dot failed",
      ["stacks site: !214, then !215: merge in order, !214 first Open"], ["stacks"]]);
  });

  it("reports a pull request page the browser couldn't open, for a host with no page of its own", async () => {
    const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/site", RemoteTransport.Https);
    const row: GitPullRequestRow = new GitPullRequestRow("214", "#214", "Change 214", "https://github.com/example-owner/site/pull/214", false, 0, 0, 0, 0,
      "feature/graph");
    onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "git.accounts", listFor: () => signal(GitPullRequestList.ready([row])),
      refresh: () => undefined
    }));
    const workspace: GitWorkspace = fresh("/work/site");
    const screen: Screen = Screen.render(workspace.id, { "/work/site": GitFixtures.status([], null, { branch: "feature/graph", remote }).toJson() });
    const handled: Promise<unknown> = new Promise(resolve => {
      vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(resolve);
    });
    screen.context.answer("openLinkAsync", () => Promise.reject(new RangeError("No browser.")));
    await screen.untilAsync(() => screen.texts(".pull-request")[0] === "#214 open");
    screen.click(".pull-request .link");

    expect(String(await handled)).toBe("RangeError: No browser.");
  });

  it("counts the repositories behind, changed, waiting for review and with agents at work, and shows only a view's while it is chosen, as a menu does, reading every one first and showing them all again from the workspace",
    async () => {
      const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/site", RemoteTransport.Https);
      const row: GitPullRequestRow = new GitPullRequestRow("533", "#533", "Change 533", "https://github.com/example-owner/site/pull/533", false, 0, 0, 0, 0, "main");
      onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
        claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "github.account", listFor: () => signal(null), refresh: () => undefined,
        branchFor: folder => signal(folder === "/work/desktop" ? GitBranchPullRequest.of(row, GitPullRequestState.Open, true) : GitBranchPullRequest.none(0, 0, 0)),
        refreshBranch: () => undefined
      }));
      const agents: WritableSignal<readonly GitAgentRow[]> = signal([new GitAgentRow("run-1", "Blame gutter", GitAgentState.Done, "/work/git-agents/blame")]);
      onTestFinished(GitAgents.provide({ listFor: folder => folder === "/work/git" ? agents : signal(null), open: () => undefined }));
      const workspace: GitWorkspace = fresh("/work/git", "/work/desktop", "/work/site");
      const screen: Screen = Screen.render(workspace.id, {
        "/work/git": statusOf("feature/graph", 3, 0, 3),
        "/work/desktop": GitFixtures.status([], new StatusUpstream("origin/main", 0, 4, false), { branch: "main", remote }).toJson(),
        "/work/site": statusOf("main", 0, 1, 0)
      });
      await screen.untilAsync(() => screen.texts(".view .badge").length === 3);
      const counted: readonly string[] = screen.texts(".side .view");
      agents.set([new GitAgentRow("run-1", "Blame gutter", GitAgentState.WaitingForYou, "/work/git-agents/blame")]);
      await screen.untilAsync(() => screen.texts(".view .badge").length === 4);
      const reads: number = screen.folders("git.status").length;
      const names = (): readonly string[] => screen.rows().map(t => t.split(" ")[0] ?? "");
      const choose = (view: number): void => {
        screen.click(".side .view", view);
      };

      choose(0);
      const behind: readonly string[] = names();
      await screen.untilAsync(() => screen.folders("git.status").length >= reads + 3);
      const current: readonly (string | null)[] = screen.all(".side .view, .side .workspace").map(t => t.getAttribute("aria-current"));
      choose(1);
      const changed: readonly string[] = names();
      choose(2);
      const review: readonly string[] = names();
      choose(3);
      const working: readonly string[] = names();
      choose(3);
      const again: readonly string[] = names();
      screen.click(".side .workspace");

      expect(counted).toEqual(["sync_problem Behind their upstream 2", "edit_note With uncommitted changes 1", "rate_review Waiting for review 1",
        "smart_toy Agents at work"]);
      expect(screen.texts(".side .view .badge")).toEqual(["2", "1", "1", "1"]);
      expect([behind, current, changed, review, working, again]).toEqual([["desktop", "site"], [null, "page", null, null, null], ["git"], ["desktop"], ["git"], ["git"]]);
      expect([screen.rows().length, screen.all(".side .selected").map(t => Screen.textOf(t)), screen.texts(".side .section .caps")])
        .toEqual([3, ["workspaces Noldova 3"], ["Workspaces", "Views", "Hosts"]]);
    });

  it("reports an agent provider whose list throws and counts its repositories as having none at work", async () => {
    const handled: string[] = [];
    const isBroken: WritableSignal<boolean> = signal(false);
    onTestFinished(GitAgents.provide({
      listFor: () => {
        if (isBroken())
          throw new RangeError("list broke");
        return signal(null);
      },
      open: () => undefined
    }));
    const workspace: GitWorkspace = fresh("/work/git");
    const screen: Screen = Screen.render(workspace.id);
    await screen.untilAsync(() => screen.texts(".sync")[0] === "Up to date");
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(String(error)));
    isBroken.set(true);
    screen.fixture.detectChanges();

    expect([handled.length > 0, new Set(handled), screen.texts(".view .badge")]).toEqual([true, new Set(["RangeError: list broke"]), []]);
  });

  it("gives the Across repositories panel the pull requests asking for a review, and opens one in its host's page, else in the browser", async () => {
    const github: GitRemote = new GitRemote("origin", "github.com", "example-owner/desktop", RemoteTransport.Https);
    const review = (number: number): GitPullRequestRow => new GitPullRequestRow(String(number), `#${number}`, `Change ${number}`,
      `https://github.com/example-owner/desktop/pull/${number}`, false, 0, 0, 0, 0, "feature/x");
    const opened: string[] = [];
    onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "git-github.account", listFor: () => signal(null), refresh: () => undefined,
      reviewsFor: () => signal(GitPullRequestList.ready([review(533), review(41)])), refreshReviews: () => undefined,
      open: (_folder, row) => {
        opened.push(row.label);
        return row.label === "#533";
      }
    }));
    const workspace: GitWorkspace = fresh("/work/desktop");
    const screen: Screen = Screen.render(workspace.id, { "/work/desktop": GitFixtures.status([], null, { branch: "main", remote: github }).toJson() });
    const links: string[] = [];
    screen.context.answer("openLinkAsync", async url => {
      links.push(url);
    });
    await screen.untilAsync(() => screen.texts(".across .review").length === 2);

    screen.click(".across .review button");
    screen.all<HTMLElement>(".across .review button")[1]?.click();
    const handled: Promise<unknown> = new Promise(resolve => {
      vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(resolve);
    });
    screen.context.answer("openLinkAsync", () => Promise.reject(new RangeError("No browser.")));
    screen.all<HTMLElement>(".across .review button")[1]?.click();

    expect(screen.texts(".across .review")).toEqual(["rate_review Review #533 · Change 533 · desktop Review", "rate_review Review #41 · Change 41 · desktop Review"]);
    expect([opened, links]).toEqual([["#533", "#41", "#41"], ["https://github.com/example-owner/desktop/pull/41"]]);
    expect(await handled).toEqual(new RangeError("No browser."));
  });

  it("lists the hosts of the repositories' remotes, signed in once one answers, opens a host's settings, and reports settings that couldn't open", async () => {
    const github: GitRemote = new GitRemote("origin", "github.com", "example-owner/site", RemoteTransport.Https);
    const nas: GitRemote = new GitRemote("origin", "nas.home", "notes", RemoteTransport.Ssh);
    const answer: WritableSignal<GitBranchPullRequest | null> = signal(null);
    onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "git-github.account", listFor: () => signal(null), refresh: () => undefined,
      branchFor: () => answer, refreshBranch: () => undefined
    }));
    const workspace: GitWorkspace = fresh("/work/site", "/work/notes", "/work/local");
    const screen: Screen = Screen.render(workspace.id, {
      "/work/site": GitFixtures.status([], null, { branch: "main", remote: github }).toJson(),
      "/work/notes": GitFixtures.status([], null, { branch: "main", remote: nas }).toJson()
    });
    const handled: Promise<unknown> = new Promise(resolve => {
      vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(resolve);
    });
    await screen.untilAsync(() => screen.texts(".host").length === 2);
    const counted: readonly string[] = screen.texts(".host");
    answer.set(GitBranchPullRequest.signedOut());
    await screen.untilAsync(() => screen.texts(".host")[0] === "GitHub Sign in");
    const signedOut: string = screen.find(".host .dot").className;
    answer.set(GitBranchPullRequest.none(0, 0, 0));
    await screen.untilAsync(() => screen.texts(".host")[0] === "GitHub signed in");
    screen.context.answer("runCommandAsync", () => Promise.resolve(null));
    screen.click("button.host");
    screen.context.answer("runCommandAsync", () => Promise.reject(new RangeError("No settings.")));
    screen.click("button.host");

    expect([counted, signedOut, screen.texts(".host"), screen.all(".host .dot").map(t => t.className), screen.find("button.host").title])
      .toEqual([["GitHub 1 remote", "Plain Git over SSH 1 remote"], "dot signed-out", ["GitHub signed in", "Plain Git over SSH 1 remote"], ["dot ok", "dot none"],
        "Open GitHub in Accounts and hosts"]);
    expect([screen.context.callsOf("runCommandAsync"), String(await handled), screen.all("div.host").length])
      .toEqual([[["desktop.openSettings", { page: "git-github.account" }], ["desktop.openSettings", { page: "git-github.account" }]], "RangeError: No settings.", 1]);
  });
});
