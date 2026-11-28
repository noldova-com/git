/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { ConflictKind, FailureCode, FileState, GitRemote, type GitStatus, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it, vi } from "vitest";

import { GitWorkspaceAcrossComponent } from "../../../../src/app/components/git-workspace-across/git-workspace-across.component.ts";
import { GitAgentState } from "../../../../src/app/enums/git-agent-state.ts";
import { GitPullRequestState } from "../../../../src/app/enums/git-pull-request-state.ts";
import type { IGitAgents } from "../../../../src/app/interfaces/i-git-agents.ts";
import type { IGitPullRequests } from "../../../../src/app/interfaces/i-git-pull-requests.ts";
import { GitAgentRow } from "../../../../src/app/models/git-agent-row.ts";
import { GitBranchPullRequest } from "../../../../src/app/models/git-branch-pull-request.ts";
import { GitPullRequestList } from "../../../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../../../src/app/models/git-pull-request-row.ts";
import { GitRepositorySummary } from "../../../../src/app/models/git-repository-summary.ts";
import type { GitRowPullRequest } from "../../../../src/app/models/git-row-pull-request.ts";
import { GitWorkspaceReview } from "../../../../src/app/models/git-workspace-review.ts";
import { GitWorkspaceReviews } from "../../../../src/app/models/git-workspace-reviews.ts";
import { GitWorkspaceRow } from "../../../../src/app/models/git-workspace-row.ts";
import { GitWorkspaceRun } from "../../../../src/app/models/git-workspace-run.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { RightEdge } from "../../../fixtures/right-edge.fixture.ts";

describe("GitWorkspaceAcrossComponent", () => {
  const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/git", RemoteTransport.Https);
  const bare: GitRemote = new GitRemote("origin", null, null, RemoteTransport.Ssh);
  const none: GitBranchPullRequest = GitBranchPullRequest.none(0, 0, 0);
  const kitUpstream: StatusUpstream = new StatusUpstream("origin/feature/kit", 1, 0, false);
  const behind: StatusUpstream = new StatusUpstream("origin/main", 0, 4, false);
  const pull = (failing: number): GitBranchPullRequest => GitBranchPullRequest.of(new GitPullRequestRow("1046", "#1046", "Kit 0.0.25",
    "https://github.com/example-owner/ui/pull/1046", false, 0, 3, failing, 0, "feature/kit"), GitPullRequestState.Open, false);
  const statusOf = (branch: string, upstream: StatusUpstream | null, conflicts: number = 0, place: GitRemote = remote, fingerprint: string = "f1"): GitStatus =>
    GitFixtures.status(Array.from({ length: conflicts }, (_, i) => GitFixtures.entry(`c${i}.ts`, FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)),
      upstream, { branch, remote: place, fingerprint });
  const rowOf = (folder: string, status: GitStatus, pullRequest: GitBranchPullRequest = none): GitWorkspaceRow =>
    new GitWorkspaceRow(folder, signal(new GitRepositorySummary(folder, status, false, null)), signal(pullRequest), signal(false));
  const agents = (open: (folder: string, row: GitAgentRow) => void = () => undefined): IGitAgents => ({ listFor: () => signal([]), open });
  const runOf = (provider: IGitAgents, folder: string, key: string, name: string, state: GitAgentState, worktree: string = folder): GitWorkspaceRun =>
    new GitWorkspaceRun(folder, folder.slice(folder.lastIndexOf("/") + 1), provider, new GitAgentRow(key, name, state, worktree));

  class Panel {
    public readonly context: FakeWindowPartContext;
    public readonly fixture: ComponentFixture<GitWorkspaceAcrossComponent>;
    public readonly opened: string[] = [];
    public readonly pullRequests: string[] = [];
    public readonly written: (readonly string[])[] = [];
    public readonly reported: unknown[] = [];
    private readonly waiters: (() => void)[] = [];

    public constructor(context: FakeWindowPartContext, fixture: ComponentFixture<GitWorkspaceAcrossComponent>) {
      this.context = context;
      this.fixture = fixture;
    }

    public get element(): HTMLElement {
      return this.fixture.nativeElement;
    }

    public static render(rows: readonly GitWorkspaceRow[], runs: readonly GitWorkspaceRun[] = [], statuses: Readonly<Record<string, GitStatus>> = {},
      writes: Readonly<Record<string, Error | null>> = {}): Panel {
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      context.answer("requestAsync", async (method, params) => {
        const folder: string = JsonReader.fromValue(params).readString("folder");
        const answer: GitStatus | Error | null | undefined = method === "git.status" ? statuses[folder] : writes[folder];
        if (Object.isUndefined(answer))
          throw new Error(`No ${method} for ${folder}.`);
        if (answer instanceof Error)
          throw answer;
        return Object.isNull(answer) ? null : answer.toJson();
      });
      const errors: ErrorHandler = new ErrorHandler();
      GitFixtures.setUp(context, [{ provide: ErrorHandler, useValue: errors }]);
      const fixture: ComponentFixture<GitWorkspaceAcrossComponent> = TestBed.createComponent(GitWorkspaceAcrossComponent);
      const panel: Panel = new Panel(context, fixture);
      vi.spyOn(errors, "handleError").mockImplementation(error => panel.reported.push(error));
      fixture.componentRef.setInput("rows", rows);
      fixture.componentRef.setInput("runs", runs);
      fixture.componentInstance.repositoryOpened.subscribe(t => panel.opened.push(t));
      fixture.componentInstance.pullRequestOpened.subscribe((t: GitRowPullRequest) => panel.pullRequests.push(`${t.row.name} ${t.pullRequest.label}`));
      fixture.componentInstance.written.subscribe(t => {
        panel.written.push(t);
        panel.waiters.forEach(wake => wake());
      });
      fixture.nativeElement.style.width = "22rem";
      fixture.autoDetectChanges();
      return panel;
    }

    public static textOf(element: Element): string {
      const walker: TreeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const pieces: string[] = [];
      for (let node: Node | null = walker.nextNode(); !Object.isNull(node); node = walker.nextNode())
        pieces.push((node.textContent ?? "").replace(/\s+/gu, " ").trim());
      return pieces.filter(t => t.length > 0).join(" ");
    }

    public texts(selector: string): readonly string[] {
      return [...document.querySelectorAll(selector)].filter(t => this.element.contains(t)).map(t => Panel.textOf(t));
    }

    public find<T extends HTMLElement = HTMLElement>(selector: string): T {
      const found: T | null = this.element.querySelector<T>(selector);
      if (Object.isNull(found))
        throw new Error(`Nothing matches ${selector}.`);
      return found;
    }

    public has(selector: string): boolean {
      return !Object.isNull(this.element.querySelector(selector));
    }

    public click(selector: string, index: number = 0): void {
      const found: HTMLElement | undefined = [...this.element.querySelectorAll<HTMLElement>(selector)][index];
      if (Object.isUndefined(found))
        throw new Error(`Nothing matches ${selector} at ${index}.`);
      found.click();
      this.fixture.detectChanges();
    }

    public requested(method: string): readonly string[] {
      return this.context.callsOf("requestAsync").filter(t => t[0] === method).map(t => JsonReader.fromValue(t[1]).readString("folder"));
    }

    public async writtenAsync(count: number): Promise<void> {
      if (this.written.length < count)
        await new Promise<void>(resolve => this.waiters.push(() => {
          if (this.written.length >= count)
            resolve();
        }));
      await this.fixture.whenStable();
    }

    public rem(element: Element): DOMRect {
      const size: number = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const rect: DOMRect = element.getBoundingClientRect();
      return new DOMRect(rect.x / size, rect.y / size, rect.width / size, rect.height / size);
    }
  }

  it("shows the branch out in several repositories, what needs the person, the agents at work and the fetch note, laid out to the design", async () => {
    const provider: IGitAgents = agents();
    const panel: Panel = Panel.render([rowOf("/work/ui", statusOf("feature/kit", kitUpstream), pull(1)), rowOf("/work/git", statusOf("feature/kit", null)),
      rowOf("/work/context", statusOf("main", null, 2)), rowOf("/work/desktop", statusOf("main", behind)), rowOf("/work/site", statusOf("main", behind)),
      rowOf("/work/tools", statusOf("main", null), GitBranchPullRequest.none(0, 2, 0))], [
      runOf(provider, "/work/terminal", "w", "Push fix/pty-resize", GitAgentState.WaitingForYou), runOf(provider, "/work/git", "a", "Blame gutter", GitAgentState.Working, "/work/git-blame"),
      runOf(provider, "/work/context", "b", "Flaky watch test", GitAgentState.Working), runOf(provider, "/work/git", "c", "Done run", GitAgentState.Done)]);
    await panel.fixture.whenStable();

    expect(panel.has(".heading")).toBe(false);
    expect(panel.texts(".change")).toEqual(["link One change in two repositories feature/kit is open in ui and git. Open all two Push all"]);
    expect(panel.texts(".needs .row")).toEqual(["pan_tool Agent in terminal waits: Push fix/pty-resize Review", "warning context: two conflicts Open",
      "error ui feature/kit: one check failing Open", "error tools main: two checks failing Open", "sync_problem Two repositories are behind and can fast-forward Pull 2"]);
    expect(panel.texts(".working .row")).toEqual(["smart_toy git · Blame gutter own worktree", "smart_toy context · Flaky watch test"]);
    expect(panel.texts(".note")).toEqual(["Fetch all runs four repositories at a time, in the background, and never changes a working folder."]);
    expect([panel.has(".quiet"), panel.has(".result"), panel.find<HTMLButtonElement>(".push-all").disabled]).toEqual([false, false, false]);

    const host: CSSStyleDeclaration = getComputedStyle(panel.element);
    const card: Element = panel.find(".change");
    const row: Element = panel.find(".needs .row");
    expect([host.paddingTop, host.paddingLeft, host.rowGap, panel.rem(card).y - panel.rem(panel.element).y]).toEqual(["12px", "12px", "12px", 0.75]);
    expect(getComputedStyle(card).paddingTop).toBe("12px");
    expect(panel.rem(card).x - panel.rem(panel.element).x).toBeCloseTo(0.75, 2);
    expect(panel.rem(card).width).toBeCloseTo(20.5, 2);
    expect(panel.rem(row).height).toBeCloseTo(1.625, 2);
    expect(panel.rem(panel.find(".needs")).y - (panel.rem(card).y + panel.rem(card).height)).toBeCloseTo(0.75, 2);
  });

  it("ends a waiting agent's Review, each Needs you action and a run's own worktree on the content edge, each row's fill 0.5rem past it on both sides, a run's with the pointer", async () => {
    const provider: IGitAgents = agents();
    const panel: Panel = Panel.render([rowOf("/work/ui", statusOf("feature/kit", kitUpstream), pull(1)), rowOf("/work/desktop", statusOf("main", behind))], [
      runOf(provider, "/work/terminal", "w", "Push fix/pty-resize", GitAgentState.WaitingForYou), runOf(provider, "/work/git", "a", "Blame gutter", GitAgentState.Working, "/work/git-blame")]);
    await panel.fixture.whenStable();
    const start: number = panel.element.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(panel.element).paddingLeft);
    const edge: number = RightEdge.contentOf(panel.element);
    const rows: HTMLElement[] = [...panel.element.querySelectorAll<HTMLElement>(".needs .row, .working .row")];
    const rem = (pixels: number): number => Math.round(pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
    const outsets: number[][] = rows.map(t => [rem(start - t.getBoundingClientRect().left), rem(t.getBoundingClientRect().right - edge)]);

    expect(RightEdge.missesOf(panel.element, edge, [".waiting [nol-toolbar-button]", ".failing [nol-toolbar-button]", ".behind [nol-toolbar-button]", ".run .small"])).toEqual([]);
    expect(outsets).toEqual(rows.map(() => [0.5, 0.5]));
    expect(getComputedStyle(panel.find(".run")).cursor).toBe("pointer");
  });

  it("opens the repositories, the failing checks' pull request or history, and the runs, reporting a run that won't open", async () => {
    const shown: string[] = [];
    const panel: Panel = Panel.render([rowOf("/work/ui", statusOf("feature/kit", kitUpstream), pull(1)), rowOf("/work/git", statusOf("feature/kit", null)),
      rowOf("/work/context", statusOf("main", null, 1)), rowOf("/work/tools", statusOf("main", null), GitBranchPullRequest.none(0, 1, 0)),
      rowOf("/work/desktop", statusOf("main", behind))], [
      runOf(agents((folder, row) => shown.push(`${folder} ${row.key}`)), "/work/terminal", "w", "Push", GitAgentState.WaitingForYou),
      runOf(agents(() => {
        throw new Error("The run is gone.");
      }), "/work/git", "a", "Blame gutter", GitAgentState.Working)]);
    await panel.fixture.whenStable();

    panel.click(".open-all");
    panel.click(".conflicted button");
    panel.click(".failing button", 0);
    panel.click(".failing button", 1);
    panel.click(".waiting button");
    panel.click(".working .run");

    expect(panel.opened).toEqual(["/work/ui", "/work/git", "/work/context", "/work/tools"]);
    expect([panel.pullRequests, shown]).toEqual([["ui #1046"], ["/work/terminal w"]]);
    expect(panel.reported.map(t => t instanceof Error ? t.message : "")).toEqual(["The run is gone."]);
    expect(panel.texts(".behind")).toEqual(["sync_problem One repository is behind and can fast-forward Pull 1"]);
  });

  it("names each repository's stacked pull requests under Needs you, in the order they merge, and opens the bottom one", async () => {
    const pullOf = (number: number, head: string, base: string): GitPullRequestRow =>
      new GitPullRequestRow(String(number), `#${number}`, `Change ${number}`, `https://github.com/example-owner/git/pull/${number}`, false, 0, 0, 0, 0, head, base);
    const list: GitPullRequestList = GitPullRequestList.ready([pullOf(215, "feature/graph", "feature/graph-base"), pullOf(214, "feature/graph-base", "main")]);
    const panel: Panel = Panel.render([new GitWorkspaceRow("/work/git", signal(new GitRepositorySummary("/work/git", statusOf("feature/graph", null), false, null)),
      signal(none), signal(false), signal(list))]);
    await panel.fixture.whenStable();
    const row: Element = panel.find(".needs .stacked");
    const icon: Element = panel.find(".needs .stacked .material-symbols-rounded");

    panel.click(".stacked button");

    expect([panel.texts(".needs .row"), panel.pullRequests]).toEqual([["stacks git: #214, then #215: merge in order, #214 first Open"], ["git #214"]]);
    expect(panel.rem(row).height).toBeCloseTo(1.625, 2);
    expect(panel.rem(icon).x - panel.rem(row).x).toBeCloseTo(0.5, 2);
    expect(panel.rem(icon).width).toBeCloseTo(0.8125, 2);
  });

  it("asks once before Push all, pushes nothing on Cancel, and on Push pushes what the confirm named, saying what it pushed, skipped and failed", async () => {
    const rows: readonly GitWorkspaceRow[] = [rowOf("/work/ui", statusOf("feature/kit", kitUpstream), pull(0)), rowOf("/work/git", statusOf("feature/kit", null)),
      rowOf("/work/terminal", statusOf("feature/kit", kitUpstream, 0, bare))];
    const panel: Panel = Panel.render(rows, [], {
      "/work/ui": statusOf("feature/kit", kitUpstream, 0, remote, "u1"), "/work/terminal": statusOf("feature/kit", kitUpstream, 0, bare, "t1")
    }, { "/work/ui": null, "/work/terminal": GitFixtures.failure(FailureCode.Git, null, "The remote refused it.") });
    const dialog = (): HTMLElement | null => document.querySelector("nol-git-bulk-push-dialog");
    const textsOf = (selector: string): string[] => [...document.querySelectorAll(selector)].map(t => (t.textContent ?? "").replace(/\s+/gu, " ").trim());
    await panel.fixture.whenStable();

    panel.click(".push-all");
    await panel.fixture.whenStable();
    const asked: readonly string[] = [...textsOf("nol-git-bulk-push-dialog .nol-dialog-title"), ...textsOf("nol-git-bulk-push-dialog li")];
    dialog()?.querySelector<HTMLElement>(".cancel")?.click();
    await panel.fixture.whenStable();
    const cancelled: readonly unknown[] = [dialog(), panel.requested("git.status"), panel.requested("git.push"), panel.written.length];

    panel.click(".push-all");
    await panel.fixture.whenStable();
    dialog()?.querySelector<HTMLElement>(".push")?.click();
    await panel.writtenAsync(1);

    expect(asked).toEqual(["Push feature/kit?", "ui: feature/kit to origin/feature/kit on github.com/example-owner/git", "git: skipped, since feature/kit has no upstream on its remote",
      "terminal: feature/kit to origin/feature/kit"]);
    expect(cancelled).toEqual([null, [], [], 0]);
    expect([dialog(), [...panel.requested("git.push")].sort(), panel.requested("git.forcePush"), panel.written]).toEqual([null, ["/work/terminal", "/work/ui"], [],
      [["/work/ui", "/work/git", "/work/terminal"]]]);
    expect(panel.texts(".result p")).toEqual(["Pushed ui.", "Skipped git: it has no upstream on its remote.", "terminal failed: The remote refused it."]);
    expect(panel.find<HTMLButtonElement>(".push-all").disabled).toBe(false);
  });

  it("pulls the repositories only behind in one click, skipping one that is no longer only behind when its turn comes", async () => {
    const panel: Panel = Panel.render([rowOf("/work/desktop", statusOf("main", behind)), rowOf("/work/site", statusOf("main", behind))], [], {
      "/work/desktop": statusOf("main", behind, 0, remote, "d1"), "/work/site": statusOf("main", new StatusUpstream("origin/main", 1, 4, false))
    }, { "/work/desktop": null });
    await panel.fixture.whenStable();

    panel.click(".behind button");
    await panel.writtenAsync(1);

    expect([panel.requested("git.pull"), panel.written]).toEqual([["/work/desktop"], [["/work/desktop", "/work/site"]]]);
    expect(panel.texts(".result p")).toEqual(["Pulled desktop.", "Skipped site: it is no longer only behind its upstream."]);
  });

  it("lists each pull request asking for the person's review after the agents waiting, before the conflicts, with a note when the host listed only some, and opens the one chosen once from its button, its number's link or the rest of its row",
    async () => {
      const host: IGitPullRequests = { claims: () => true, hostName: "GitHub", signInPage: "github.account", listFor: () => signal(null), refresh: () => undefined };
      const review = (number: number, repository: string): GitWorkspaceReview => new GitWorkspaceReview(new GitPullRequestRow(String(number), `#${number}`,
        `Change ${number}`, `https://github.com/example-owner/${repository}/pull/${number}`, false, 0, 0, 0, 0, "feature/x"), `/work/${repository}`, repository, host);
      const reviews: readonly GitWorkspaceReview[] = [review(533, "desktop"), review(41, "site")];
      const panel: Panel = Panel.render([rowOf("/work/context", statusOf("main", null, 1))], [runOf(agents(), "/work/terminal", "w", "Push", GitAgentState.WaitingForYou)]);
      const opened: GitWorkspaceReview[] = [];
      panel.fixture.componentInstance.reviewOpened.subscribe(t => opened.push(t));
      panel.fixture.componentRef.setInput("reviews", new GitWorkspaceReviews(reviews, true));
      await panel.fixture.whenStable();

      panel.click(".review button", 1);
      panel.click(".review a", 0);
      panel.click(".review", 0);

      expect(panel.texts(".needs .row, .needs .more")).toEqual(["pan_tool Agent in terminal waits: Push Review", "rate_review Review #533 Change 533 · desktop Review",
        "rate_review Review #41 Change 41 · site Review", "More pull requests ask for your review than the host listed.", "warning context: one conflict Open"]);
      expect([panel.find(".review").title, [...panel.find(".review").querySelectorAll(".grow [title]")].map(t => [t.textContent, t.getAttribute("title")])])
        .toEqual(["", [["Change 533", "Change 533"]]]);
      expect(panel.rem(panel.find(".review")).height).toBeCloseTo(1.625, 2);
      expect([opened, panel.find(".review a").getAttribute("href"), getComputedStyle(panel.find(".review")).cursor])
        .toEqual([[reviews[1], reviews[0], reviews[0]], "https://github.com/example-owner/desktop/pull/533", "pointer"]);
    });

  it("shows Needs you, without the quiet line, when only a review is asked for", async () => {
    const host: IGitPullRequests = { claims: () => true, hostName: "GitHub", signInPage: "github.account", listFor: () => signal(null), refresh: () => undefined };
    const panel: Panel = Panel.render([rowOf("/work/a", statusOf("main", null))]);
    panel.fixture.componentRef.setInput("reviews", new GitWorkspaceReviews([new GitWorkspaceReview(new GitPullRequestRow("9", "#9", "Change 9",
      "https://github.com/example-owner/a/pull/9", false, 0, 0, 0, 0, "fix/y"), "/work/a", "a", host)], false));
    await panel.fixture.whenStable();

    expect([panel.texts(".needs .row"), panel.has(".quiet"), panel.has(".more")]).toEqual([["rate_review Review #9 Change 9 · a Review"], false, false]);
  });

  it("names the account a review request was listed for after its repository, keeping the number as the link", async () => {
    const host: IGitPullRequests = { claims: () => true, hostName: "GitHub", signInPage: "github.account", listFor: () => signal(null), refresh: () => undefined };
    const panel: Panel = Panel.render([rowOf("/work/a", statusOf("main", null))]);
    panel.fixture.componentRef.setInput("reviews", new GitWorkspaceReviews([new GitWorkspaceReview(new GitPullRequestRow("9", "#9", "Change 9",
      "https://github.com/example-owner/a/pull/9", false, 0, 0, 0, 0, "fix/y", null, "kim"), "/work/a", "a", host)], false));
    await panel.fixture.whenStable();

    expect([panel.texts(".needs .row"), panel.find(".review a").textContent?.trim()]).toEqual([["rate_review Review #9 Change 9 · a · kim Review"], "#9"]);
  });

  it("says nothing needs the person when nothing does", async () => {
    const panel: Panel = Panel.render([rowOf("/work/a", statusOf("main", null)), rowOf("/work/b", statusOf("main", null))]);
    await panel.fixture.whenStable();

    expect([panel.texts(".quiet"), panel.has(".change"), panel.has(".needs"), panel.has(".working")]).toEqual([["Nothing across these repositories needs you."], false, false, false]);
  });

  it("shows the agents at work alone, without the quiet line, when only agents work", async () => {
    const panel: Panel = Panel.render([rowOf("/work/a", statusOf("main", null))], [runOf(agents(), "/work/a", "a", "Blame gutter", GitAgentState.Working)]);
    await panel.fixture.whenStable();

    expect([panel.texts(".working .row"), panel.has(".quiet"), panel.has(".needs")]).toEqual([["smart_toy a · Blame gutter"], false, false]);
  });

  it("keeps Push all unavailable when no repository of the change has an upstream", async () => {
    const panel: Panel = Panel.render([rowOf("/work/ui", statusOf("feature/kit", null), pull(0)), rowOf("/work/git", statusOf("feature/kit", null))]);
    await panel.fixture.whenStable();

    expect([panel.find<HTMLButtonElement>(".push-all").disabled, panel.has(".quiet")]).toEqual([true, false]);
  });
});
