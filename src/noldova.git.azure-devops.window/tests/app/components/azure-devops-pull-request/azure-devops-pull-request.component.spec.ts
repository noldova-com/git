/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed, TestComponentRenderer } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import type { JsonValue } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException, WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { CheckState, FileChangeKind, HostAccount, HostBuild, HostChanges, HostComment, HostItem, HostPerson, HostPolicy, HostPullRequest, HostPullRequestCommit, HostPullRequestCommits, HostPullRequestConflicts,
  HostPullRequestFile, HostPullRequestFiles,
  HostPullRequestThreads, HostPullRequestUpdate, HostPullRequestUpdates, HostReference, HostReviewer, HostSignIn, HostThread, HostWorkItemLink, HostWorkItemType, PolicyState, ReferenceKind,
  ReferenceState, ThreadStatus, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { DiffFile, DiffHunk, DiffLine, FileChange, GitDiff, GitNames, GitPullParams, GitRemote, GitStatus, LineKind, RemoteTransport, StatusUpstream }
  from "@noldova/git.protocol";
import { GitFileLine, GitFolder, GitPullRequestFilesComponent } from "@noldova/git.window";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { describe, expect, it, onTestFinished } from "vitest";

import { AzureDevOpsPullRequestComponent } from "../../../../src/app/components/azure-devops-pull-request/azure-devops-pull-request.component.ts";
import { AzureDevOpsPullRequestDetailComponent }
  from "../../../../src/app/components/azure-devops-pull-request-detail/azure-devops-pull-request-detail.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const INSTANCE: string = `fabrikam/${REPOSITORY}/482`;
const URL: string = "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/482";
const CREATED: number = Date.UTC(2026, 10, 20, 12);
const COMMIT: string = "0123456789abcdef0123456789abcdef01234567";
const OLD: number = Date.UTC(2026, 0, 5, 12);
const MISSING: string = "key This pull request can't be shown. Sign in to its organization in Settings → Accounts and hosts, or check that it still exists.";
const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 482);
const item: HostItem = new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Open, "Export notes as Markdown from the shared notes list", URL,
  new HostPerson("monalisa@fabrikam.com", null, null), CREATED, null, 0,
  new HostChanges(null, null, null, "users/monalisa/4821-export-notes", "main", "0123456789abcdef0123456789abcdef01234567"));
const story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");
const pullRequest: HostPullRequest = new HostPullRequest(item, [
  new HostReviewer(new HostPerson("octocat@fabrikam.com", null, null), 0.5, "Approved with suggestions", true),
  new HostReviewer(new HostPerson("hubot@fabrikam.com", null, null), -0.5, "Waiting for the author", false),
  new HostReviewer(new HostPerson("[Web Site]\\Web Team", null, null), 0, "No vote", false),
  new HostReviewer(new HostPerson("monalisa@fabrikam.com", null, null), -1, "Rejected", false)
], [
  new HostPolicy("Minimum number of reviewers", PolicyState.Approved, true, null),
  new HostPolicy("Comment requirements", PolicyState.Rejected, true, null),
  new HostPolicy("Work item linking", PolicyState.Running, false, null)
], [
  new HostBuild("site-ci", CheckState.Succeeded, "https://dev.azure.com/fabrikam/web/_build/results?buildId=7", CREATED, CREATED + 372_000),
  new HostBuild("dependency scan", CheckState.Queued, null, null, null)
], true, "Readers see **due dates** before they pass.", 5, [
  new HostWorkItemLink(4821, "Export notes as Markdown files", story, "Active", WorkItemCategory.InProgress, "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/4821"),
  new HostWorkItemLink(4799, "Due dates ignore local times", new HostWorkItemType("Bug", "CC293D", "icon_unknown"), "New",
    WorkItemCategory.Proposed, "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/4799")
]);

const opened: HostPullRequest = new HostPullRequest(item, [], [], [], false, "", 5, []);
const merged: HostPullRequest = new HostPullRequest(new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Merged, item.title, URL, null, CREATED, CREATED, 0,
  item.changes), [], [], [], false, "", 5, []);

function cloneStatus(branch: string = "main", upstream: string = "origin/main"): JsonValue {
  return new GitStatus(branch, "a".repeat(40), new StatusUpstream(upstream, 0, 1, false), [], false, `f-${branch}`, null,
    new GitRemote("origin", "dev.azure.com", "fabrikam/Web%20Site/_git/site", RemoteTransport.Https)).toJson();
}

function otherPullRequest(state: ReferenceState): HostPullRequest {
  const other = new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 7);
  return new HostPullRequest(new HostItem(other, ReferenceKind.PullRequest, state, "Another change", URL, null, CREATED,
    state === ReferenceState.Merged ? CREATED : null, 0,
    new HostChanges(null, null, null, "another-change", "main", "0123456789abcdef0123456789abcdef01234567")), [], [], [], false, "", null, []);
}

function wordsOf(node: Node): string {
  const words: string[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text !== null; text = walker.nextNode())
    words.push((text.textContent ?? "").trim());
  return words.filter(t => t.length > 0).join(" ").replace(/\s+/g, " ");
}

/** Keeps every fixture's root in the document, where the default renderer takes the page's away once the view's is made, so both show as the window shows them. */
class SideBySideRenderer extends TestComponentRenderer {
  public override insertRootElement(rootElementId: string): void {
    const root: HTMLDivElement = document.createElement("div");
    root.id = rootElementId;
    document.body.append(root);
  }

  public override removeAllRootElements(): void {
    for (const root of document.querySelectorAll("[id^=root]"))
      root.remove();
  }
}

class Page {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context).ignore(AzureDevOpsNames.readPersonAvatarMethod);
  public fixture: ComponentFixture<AzureDevOpsPullRequestComponent> | null = null;
  /** The Pull request view beside the page, as the window docks it. */
  public view: ComponentFixture<AzureDevOpsPullRequestDetailComponent> | null = null;
  /** Whether the page is the window's active document. */
  public readonly active: WritableSignal<boolean> = signal(true);

  public constructor(threads: readonly HostThread[] = [], signIn: HostSignIn | Error = HostSignIn.signedIn(new HostAccount("monalisa@fabrikam.com", "Mona Lisa", null, []))) {
    const answer: JsonValue = new HostPullRequestThreads(threads, false).toJson();
    const types: JsonValue = ["noFastForward", "squash", "rebase", "rebaseMerge"];
    this.requests.answer(AzureDevOpsNames.readPullRequestThreadsMethod, answer, answer, answer);
    if (signIn instanceof Error)
      this.requests.fail(AzureDevOpsNames.readSignInMethod, signIn);
    else
      this.requests.answer(AzureDevOpsNames.readSignInMethod, signIn.toJson());
    this.requests.answer(AzureDevOpsNames.readMergeTypesMethod, types, types, types);
    this.requests.otherwise(AzureDevOpsNames.readPullRequestChangesMethod, new HostPullRequestFiles(null, null, [], false).toJson())
      .otherwise(AzureDevOpsNames.readPullRequestUpdatesMethod, new HostPullRequestUpdates([], false).toJson());
  }

  public get logs(): readonly unknown[] {
    return this.context.callsOf("log").map(t => t[0]);
  }

  public payloadsOf(method: string): readonly unknown[] {
    return this.requests.payloads.filter((_, i) => this.requests.methods[i] === method);
  }

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The page isn't open.");
    return element;
  }

  public get detail(): HTMLElement {
    const element = this.view?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The view isn't open.");
    return element;
  }

  public get text(): string {
    return wordsOf(this.element);
  }

  public get links(): readonly unknown[] {
    return this.context.callsOf("openLinkAsync").map(t => t[0]);
  }

  public async openAsync(instance: string = INSTANCE): Promise<this> {
    this.create(instance);
    await this.settleAsync();
    return this;
  }

  public create(instance: string = INSTANCE): void {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context },
      { provide: WindowPartTokens.activeDocument, useValue: this.active }, { provide: TestComponentRenderer, useClass: SideBySideRenderer }, provideMarkdown()] });
    this.fixture = TestBed.createComponent(AzureDevOpsPullRequestComponent);
    this.fixture.componentRef.setInput("instance", instance);
    this.fixture.autoDetectChanges();
    this.view = TestBed.createComponent(AzureDevOpsPullRequestDetailComponent);
    this.view.componentRef.setInput("instance", "selected");
    this.view.autoDetectChanges();
  }

  public untilAsync(done: () => boolean): Promise<void> {
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
  }

  public async settleAsync(): Promise<void> {
    await this.fixture?.whenStable();
    this.fixture?.detectChanges();
    this.view?.detectChanges();
    await this.fixture?.whenStable();
    await this.view?.whenStable();
  }

  /** The first element the selector matches on the page, then in the Pull request view; null for none. */
  public query(selector: string): Element | null {
    return this.element.querySelector(selector) ?? this.detail.querySelector(selector);
  }

  /** The elements the selector matches on the page, then in the Pull request view. */
  public queryAll<T extends Element = Element>(selector: string): T[] {
    return [...this.element.querySelectorAll<T>(selector), ...this.detail.querySelectorAll<T>(selector)];
  }

  /** The texts the selector matches on the page, then in the Pull request view. */
  public texts(selector: string): string[] {
    return [...this.element.querySelectorAll(selector), ...this.detail.querySelectorAll(selector)].map(wordsOf);
  }

  public find(selector: string): HTMLElement {
    const found = this.element.querySelector(selector) ?? this.detail.querySelector(selector);
    if (!(found instanceof HTMLElement))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  }

  public async voteAsync(choice: string): Promise<string[]> {
    const items = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("button[nol-menu-item]")];
    this.find(".vote-menu").click();
    await this.untilAsync(() => items().length > 0);
    const listed: string[] = items().map(wordsOf);
    const chosen = items().find(t => wordsOf(t) === choice);
    if (chosen === undefined)
      throw new Error(`The vote menu has no ${choice}.`);
    chosen.click();
    return listed;
  }

  public async untilAskedAsync(method: string, count: number): Promise<void> {
    while (this.payloadsOf(method).length < count)
      await this.requests.askedAsync(this.requests.answered.length + 1);
  }

  public async completeWithPullAsync(folder: string = "/work/site"): Promise<void> {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal(folder)));
    await this.openAsync();
    await this.untilAsync(() => this.query(".pull-after") !== null && this.query(".complete-merge:not([disabled])") !== null);
    this.find(".pull-after input").click();
    await this.settleAsync();
    await this.clickAsync("Complete merge");
    this.find(".confirm-action").click();
  }

  public async clickAsync(label: string): Promise<void> {
    const found = [...this.element.querySelectorAll("button"), ...this.detail.querySelectorAll("button")]
      .find(t => wordsOf(t).includes(label) || t.getAttribute("aria-label") === label);
    if (found === undefined)
      throw new Error(`No button reads ${label}.`);
    found.click();
    await this.settleAsync();
  }
}

describe("AzureDevOpsPullRequestComponent", () => {
  it("reads the pull request its document names and shows its header, description, policies, reviewers, work items with their state's colour and builds", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    await page.openAsync();

    const opened: string = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(CREATED);
    expect([page.requests.methods.slice(0, 2), [...page.requests.methods.slice(2)].sort(), page.payloadsOf(AzureDevOpsNames.readSignInMethod),
      page.payloadsOf(AzureDevOpsNames.readPullRequestMethod), page.payloadsOf(AzureDevOpsNames.readMergeTypesMethod)]).toEqual([
      [AzureDevOpsNames.readSignInMethod, AzureDevOpsNames.readPullRequestMethod],
      [AzureDevOpsNames.readMergeTypesMethod, AzureDevOpsNames.readPullRequestChangesMethod, AzureDevOpsNames.readPullRequestThreadsMethod,
        AzureDevOpsNames.readPullRequestUpdatesMethod, AzureDevOpsNames.readSignInMethod].sort(), [null, null], [reference.toJson()], [reference.toJson()]]);
    expect(page.texts(".title-line")).toEqual(["radio_button_checked Active !482 Export notes as Markdown from the shared notes list open_in_new Open in Azure DevOps"]);
    expect(page.texts(".vote-line")).toEqual(["Your vote: Rejected. Votes and comments go to Azure DevOps as you. check Approve expand_more"]);
    expect(page.texts(".meta")).toEqual([`M monalisa@fabrikam.com wants to merge users/monalisa/4821-export-notes into main · 5 commits · opened ${opened}`
      + " schedule Completes by itself once its policies pass"]);
    expect(page.texts(".tab")).toEqual(["Overview", "Files 0", "Updates 0", "Commits 5", "Conflicts"]);
    await page.untilAsync(() => page.query(".description strong") !== null);
    expect(page.find(".description strong").textContent).toBe("due dates");
    expect(page.texts(".card-head")).toEqual(["Policies 1 of 2 required passed · branch main"]);
    expect(page.texts(".policy")).toEqual(["check_circle Minimum number of reviewers Required", "error Comment requirements Required",
      "progress_activity Work item linking Optional · running"]);
    expect([...page.queryAll(".policy [role=img]")].map(t => t.getAttribute("aria-label"))).toEqual(["Passed", "Failed", "Running"]);
    expect(page.texts(".reviewer")).toEqual(["O check octocat@fabrikam.com Approved with suggestions Required",
      "H schedule hubot@fabrikam.com Waiting for the author", "groups Web Team No vote yet · optional", "M close monalisa@fabrikam.com Rejected"]);
    expect([page.queryAll(".vote.approved").length, page.queryAll(".vote.waiting").length,
      page.queryAll(".vote.rejected").length]).toEqual([1, 1, 1]);
    expect(page.texts("button.row")).toEqual(["menu_book 4821 Export notes as Markdown files Active", "description 4799 Due dates ignore local times New"]);
    expect([...page.queryAll<HTMLElement>(".work-state .dot")].map(t => t.style.backgroundColor)).toEqual(["var(--nol-accent)", "var(--nol-text-muted)"]);
    expect(page.texts("div.row")).toEqual(["check_circle site-ci · 6 min 12 s open_in_new", "schedule dependency scan"]);
  });

  it("keeps the overview to one column and shows the reviewers, policies, builds, work items and Complete in the Pull request view, in that order", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    await page.openAsync();
    await page.untilAsync(() => page.detail.querySelector("nol-git-azure-devops-complete") !== null);

    expect([page.element.querySelector(".side, .reviewer, .policy, div.row, button.row, nol-git-azure-devops-complete"),
      [...page.detail.querySelectorAll(".detail > section, nol-git-azure-devops-complete")].map(t => t.getAttribute("aria-label") ?? t.tagName.toLowerCase())])
      .toEqual([null, ["Reviewers", "Policies", "Builds", "Work items", "nol-git-azure-devops-complete"]]);
  });

  it("opens the Pull request view, without showing it, once its pull request is read, leaves it open for the next one, and titles it for the one it shows",
    async () => {
      const page = new Page();
      page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson(), otherPullRequest(ReferenceState.Open).toJson());
      await page.openAsync();
      const first: unknown = page.context.callsOf("updateView").at(-1);
      page.fixture?.componentRef.setInput("instance", `fabrikam/${REPOSITORY}/7`);
      await page.untilAsync(() => page.texts(".title-line").some(t => t.includes("Another change")));
      await page.settleAsync();

      expect([page.context.callsOf("openView"), page.context.callsOf("showView"), first, page.context.callsOf("updateView").at(-1)])
        .toEqual([[["git-azure-devops.pullRequestDetail", "selected", "Pull request !482"]], [],
          ["git-azure-devops.pullRequestDetail", "selected", { title: "Pull request !482" }], ["git-azure-devops.pullRequestDetail", "selected", { title: "Pull request !7" }]]);
    });

  it("keeps the last pull request in the view while another kind of document is in front, and says to open one once no pull request is open", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    await page.openAsync();
    page.active.set(false);
    await page.settleAsync();
    const kept: string[] = page.texts(".reviewer");
    page.fixture?.destroy();
    page.view?.detectChanges();
    await page.view?.whenStable();

    expect([kept.length, wordsOf(page.detail), page.context.callsOf("updateView").at(-1)]).toEqual([4, "Open a pull request to see its details here.",
      ["git-azure-devops.pullRequestDetail", "selected", { title: "Pull request" }]]);
  });

  it.each([["squash", "schedule Auto-complete set: squash commit when policies pass"], ["rebaseMerge", "schedule Auto-complete set: semi-linear merge when policies pass"],
    ["fastForwardOnly", "schedule Completes by itself once its policies pass"], [null, "schedule Completes by itself once its policies pass"]])(
    "names the merge type %s auto-complete completes with, and says only that it completes by itself without one it knows", async (mergeType, line) => {
      const page = new Page();
      page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(pullRequest.item, pullRequest.reviewers, pullRequest.policies, pullRequest.builds,
        true, pullRequest.description, pullRequest.commitCount, pullRequest.workItems, mergeType).toJson());
      await page.openAsync();

      expect(page.texts(".auto")).toEqual([line]);
    });

  it("shows a build policy's build number beside its name, running after Required or Optional for a policy that runs, and each build's number", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(item, [], [
      new HostPolicy("Build: portal-web PR validation", PolicyState.Approved, true, null, "20261121.4"),
      new HostPolicy("Build: dependency scan", PolicyState.Running, false, null, "20261121.5"),
      new HostPolicy("Build: smoke", PolicyState.Running, true, null)
    ], [
      new HostBuild("PR validation", CheckState.Succeeded, null, CREATED, CREATED + 372_000, "20261121.4"),
      new HostBuild("dependency scan", CheckState.Queued, null, null, null)
    ], false, "", 1, []).toJson());
    await page.openAsync();

    expect(page.texts(".policy")).toEqual(["check_circle Build: portal-web PR validation 20261121.4 Required", "progress_activity Build: dependency scan 20261121.5 Optional · running",
      "progress_activity Build: smoke Required · running"]);
    expect(page.texts("div.row")).toEqual(["check_circle PR validation · 6 min 12 s #20261121.4", "schedule dependency scan"]);
  });

  it("opens the pull request, a work item and a build on Azure DevOps", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.context.answer("openLinkAsync", async () => undefined);
    await page.openAsync();

    for (const label of ["Open in Azure DevOps", "Export notes as Markdown files"])
      await page.clickAsync(label);
    page.find("div.row button").click();
    await page.settleAsync();

    expect(page.links).toEqual([URL, "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/4821",
      "https://dev.azure.com/fabrikam/web/_build/results?buildId=7"]);
  });

  it("switches to Updates and Commits inside the page, Updates showing the pushes the page read and Commits reading when it first opens, each keeping its answer and"
    + " count while another tab shows", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, new HostPullRequestUpdates([new HostPullRequestUpdate(1, null, OLD, COMMIT, null)], false).toJson());
    page.requests.answer(AzureDevOpsNames.readPullRequestCommitsMethod, new HostPullRequestCommits([new HostPullRequestCommit(COMMIT, "Add note export", "Mona Lisa", OLD),
      new HostPullRequestCommit(COMMIT, "Respect local times", "Mona Lisa", OLD)], false).toJson());
    await page.openAsync();
    const current = (): (string | null)[] => [...page.queryAll(".tab")].map(t => t.getAttribute("aria-current"));
    const shown = (): boolean[] => [".body", "nol-git-azure-devops-pull-request-updates", "nol-git-pull-request-commits"]
      .map(t => page.query(t)?.checkVisibility() ?? false);

    const before = [current(), shown(), page.texts(".tab")];
    await page.clickAsync("Updates");
    await page.untilAsync(() => page.texts(".tab")[2] === "Updates 1");
    const updates = [current(), shown(), page.texts("nol-git-azure-devops-pull-request-updates .row")];
    await page.clickAsync("Commits");
    await page.untilAsync(() => page.texts(".tab")[3] === "Commits 2");
    const commits = [current(), shown(), page.texts("nol-git-pull-request-commits .subject")];
    await page.clickAsync("Overview");
    await page.clickAsync("Updates");

    expect(before).toEqual([["page", null, null, null, null], [true, false, false], ["Overview", "Files 0", "Updates 1", "Commits 5", "Conflicts"]]);
    expect(updates).toEqual([[null, null, "page", null, null], [false, true, false], [`Update 1 Someone ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(OLD)} 0123456`]]);
    expect(commits).toEqual([[null, null, null, "page", null], [false, false, true], ["Add note export", "Respect local times"]]);
    const tabReads: unknown[] = page.requests.methods.filter(t => t !== AzureDevOpsNames.readSignInMethod && t !== AzureDevOpsNames.readMergeTypesMethod);
    expect([current(), shown(), tabReads]).toEqual([[null, null, "page", null, null], [false, true, false], [AzureDevOpsNames.readPullRequestMethod,
      AzureDevOpsNames.readPullRequestChangesMethod, AzureDevOpsNames.readPullRequestUpdatesMethod, AzureDevOpsNames.readPullRequestThreadsMethod,
      AzureDevOpsNames.readPullRequestCommitsMethod]]);
  });

  it("counts Files and Updates before they open, from one read of each once the pull request shows, which the tabs show without reading again", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.requests.answer(AzureDevOpsNames.readPullRequestChangesMethod, new HostPullRequestFiles(COMMIT, null, Array.from({ length: 12 }, (_, i) =>
      new HostPullRequestFile(`src/f${String(i)}.ts`, FileChangeKind.Modified, null)), false).toJson());
    page.requests.answer(AzureDevOpsNames.readPullRequestUpdatesMethod, new HostPullRequestUpdates(Array.from({ length: 100 }, (_, i) =>
      new HostPullRequestUpdate(i + 1, null, OLD, COMMIT, null)), true).toJson());
    await page.openAsync();
    const counted = page.texts(".tab");

    await page.clickAsync("Files");
    await page.clickAsync("Updates");

    expect(counted).toEqual(["Overview", "Files 12", "Updates 100+", "Commits 5", "Conflicts"]);
    expect([page.texts("nol-git-pull-request-files .row").length, page.texts("nol-git-azure-devops-pull-request-updates .row").length,
      page.payloadsOf(AzureDevOpsNames.readPullRequestChangesMethod), page.payloadsOf(AzureDevOpsNames.readPullRequestUpdatesMethod)])
      .toEqual([12, 100, [reference.toJson()], [reference.toJson()]]);
  });

  it("says a tab is reading while the page's read of it runs, then shows its answer", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    const files = page.requests.hold(AzureDevOpsNames.readPullRequestChangesMethod);
    const updates = page.requests.hold(AzureDevOpsNames.readPullRequestUpdatesMethod);
    page.create();
    await page.untilAsync(() => page.query(".tab") !== null);
    const status = (): string[] => page.texts(".pane:not([hidden]) [role=status]");
    page.queryAll<HTMLElement>(".tab")[1]?.click();
    await page.untilAsync(() => status().length > 0);
    const reading = [status(), page.texts(".tab")[1]];
    page.queryAll<HTMLElement>(".tab")[2]?.click();
    await page.untilAsync(() => status()[0] !== reading[0]?.[0]);
    const updating = status();

    files(new HostPullRequestFiles(COMMIT, null, [new HostPullRequestFile("src/a.ts", FileChangeKind.Added, null)], false).toJson());
    updates(new HostPullRequestUpdates([new HostPullRequestUpdate(1, null, OLD, COMMIT, null)], false).toJson());
    await page.untilAsync(() => page.texts(".tab")[2] === "Updates 1");
    await page.settleAsync();

    expect([reading, updating]).toEqual([[["Reading the files on Azure DevOps."], "Files"], ["Reading the updates on Azure DevOps."]]);
    expect([page.texts(".tab")[1], page.texts("nol-git-azure-devops-pull-request-updates .row").length, page.query(".pane > .notice")]).toEqual(["Files 1", 1, null]);
  });

  it("logs a read of a tab the window fails, shows no count for it, and reads it when the tab opens", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.requests.fail(AzureDevOpsNames.readPullRequestChangesMethod, new WindowFailure("The runtime stopped."));
    page.requests.fail(AzureDevOpsNames.readPullRequestUpdatesMethod, new WindowFailure("The runtime stopped."));
    page.requests.answer(AzureDevOpsNames.readPullRequestChangesMethod, new HostPullRequestFiles(COMMIT, null, [new HostPullRequestFile("src/a.ts",
      FileChangeKind.Added, null)], false).toJson());
    await page.openAsync();
    const failed = [page.texts(".tab"), page.logs];

    await page.clickAsync("Files");
    await page.untilAsync(() => page.texts(".tab")[1] === "Files 1");

    expect(failed).toEqual([["Overview", "Files", "Updates", "Commits 5", "Conflicts"], [
      "The Azure DevOps module's git-azure-devops.readPullRequestChanges request failed: WindowFailure: The runtime stopped.",
      "The Azure DevOps module's git-azure-devops.readPullRequestUpdates request failed: WindowFailure: The runtime stopped."]]);
    expect([page.texts("nol-git-pull-request-files .row"), page.payloadsOf(AzureDevOpsNames.readPullRequestChangesMethod).length]).toEqual([["A src/a.ts"], 2]);
  });

  it("drops a tab's answer or failure read for a pull request the page left", async () => {
    const page = new Page();
    const other = new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 7);
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson(), otherPullRequest(ReferenceState.Open).toJson());
    const files = page.requests.hold(AzureDevOpsNames.readPullRequestChangesMethod);
    const updates = page.requests.holdFailure(AzureDevOpsNames.readPullRequestUpdatesMethod);
    page.create();
    await page.untilAskedAsync(AzureDevOpsNames.readPullRequestUpdatesMethod, 1);

    page.fixture?.componentRef.setInput("instance", `fabrikam/${REPOSITORY}/7`);
    await page.untilAsync(() => page.texts(".title")[0] === "Another change");
    files(new HostPullRequestFiles(COMMIT, null, [new HostPullRequestFile("src/a.ts", FileChangeKind.Added, null)], false).toJson());
    updates(new WindowFailure("The runtime stopped."));
    await Promise.allSettled(page.requests.answered);
    await page.settleAsync();

    expect([page.texts(".tab"), page.payloadsOf(AzureDevOpsNames.readPullRequestChangesMethod), page.logs.length])
      .toEqual([["Overview", "Files 0", "Updates 0", "Commits", "Conflicts"], [reference.toJson(), other.toJson()], 1]);
  });

  it("rethrows a failure of a tab's read that isn't the window's", async () => {
    const page = new Page();
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.requests.fail(AzureDevOpsNames.readPullRequestChangesMethod, new RangeError("Unexpected."));
    await page.openAsync();

    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("goes back to Overview with no tab read for another document instance", async () => {
    const page = new Page();
    const other = new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 7);
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson(), new HostPullRequest(new HostItem(other, ReferenceKind.PullRequest,
      ReferenceState.Open, "Another change", URL, null, CREATED, null, 0, new HostChanges(null, null, null, "another-change", "main", COMMIT)), [], [], [], false, "", null,
      []).toJson());
    page.requests.answer(AzureDevOpsNames.readPullRequestCommitsMethod, new HostPullRequestCommits([], false).toJson());
    await page.openAsync();
    await page.clickAsync("Commits");
    await page.untilAsync(() => page.texts(".tab")[3] === "Commits 0");

    page.fixture?.componentRef.setInput("instance", `fabrikam/${REPOSITORY}/7`);
    await page.untilAsync(() => page.texts(".title")[0] === "Another change");

    expect([page.texts(".tab"), page.query("nol-git-pull-request-commits"), page.find(".tab").getAttribute("aria-current")])
      .toEqual([["Overview", "Files 0", "Updates 0", "Commits", "Conflicts"], null, "page"]);
  });

  it("switches to Files and Conflicts inside the page, Files showing the files the page read and Conflicts reading when it first opens, with their counts",
    async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.requests.answer(AzureDevOpsNames.readPullRequestChangesMethod, new HostPullRequestFiles(COMMIT, null, [new HostPullRequestFile("src/a.ts",
      FileChangeKind.Added, null), new HostPullRequestFile("src/b.ts", FileChangeKind.Modified, null)], false).toJson());
    page.requests.answer(AzureDevOpsNames.readPullRequestConflictsMethod, new HostPullRequestConflicts(["src/b.ts"], false).toJson());
    await page.openAsync();
    const current = (): (string | null)[] => [...page.queryAll(".tab")].map(t => t.getAttribute("aria-current"));
    const shown = (): boolean[] => [".body", "nol-git-pull-request-files", "nol-git-pull-request-conflicts"]
      .map(t => page.query(t)?.checkVisibility() ?? false);

    await page.clickAsync("Files");
    await page.untilAsync(() => page.texts(".tab")[1] === "Files 2");
    const files = [current(), shown(), page.texts("nol-git-pull-request-files .row")];
    await page.clickAsync("Conflicts");
    await page.untilAsync(() => page.texts(".tab")[4] === "Conflicts 1");

    expect(files).toEqual([[null, "page", null, null, null], [false, true, false], ["A src/a.ts", "M src/b.ts"]]);
    const tabReads: unknown[] = page.requests.methods.filter(t => t !== AzureDevOpsNames.readSignInMethod && t !== AzureDevOpsNames.readMergeTypesMethod);
    expect([current(), shown(), page.texts("nol-git-pull-request-conflicts .row"), tabReads]).toEqual([[null, null, null, null, "page"],
      [false, false, true], ["warning src/b.ts"], [AzureDevOpsNames.readPullRequestMethod, AzureDevOpsNames.readPullRequestChangesMethod,
        AzureDevOpsNames.readPullRequestUpdatesMethod, AzureDevOpsNames.readPullRequestThreadsMethod, AzureDevOpsNames.readPullRequestConflictsMethod]]);
  });

  it("shows a pull request with nothing to list, no commit count and no author plainly", async () => {
    const page = new Page();
    const bare = new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Draft, "Draft: new intake form", URL, null, CREATED, null, 0,
      new HostChanges(null, null, null, "intake-form", "main", "0123456789abcdef0123456789abcdef01234567"));
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(bare, [], [new HostPolicy("Build", PolicyState.Queued, true, null)], [], false, " ",
      null, []).toJson());
    await page.openAsync();

    expect(page.texts(".meta")[0]?.startsWith("Someone wants to merge intake-form into main · opened")).toBe(true);
    expect(page.texts(".tab")).toEqual(["Overview", "Files 0", "Updates 0", "Commits", "Conflicts"]);
    expect([page.texts(".card-head"), page.texts(".description p"), page.texts(".list p")]).toEqual([["Policies 0 of 1 required passed · branch main"], ["No description."],
      ["No reviewers.", "No builds.", "No linked work items."]]);
    expect(page.texts(".policy")).toEqual(["schedule Build Required"]);
  });

  it("times a running build from its start to when the page read it", async () => {
    const page = new Page();
    const running = new HostPullRequest(item, [], [], [new HostBuild("site-ci", CheckState.Running, null, Date.now() - 125_000, null)], false, "", 1, []);
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, running.toJson());
    await page.openAsync();

    expect(page.texts("div.row")[0]).toMatch(/^progress_activity site-ci · 2 min [5-9] s so far$/);
    expect(page.texts(".card p")).toEqual(["No branch policies."]);
    expect(page.texts(".meta")[0]).toContain("· 1 commit ·");
  });

  it("says so, without asking Azure DevOps, for a document that names no pull request", async () => {
    const page = await new Page().openAsync("fabrikam/482");

    expect([page.text, page.requests.methods]).toEqual([MISSING, [AzureDevOpsNames.readSignInMethod]]);
  });

  it("says so when Azure DevOps shows no pull request", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, null);
    await page.openAsync();

    expect(page.text).toBe(MISSING);
  });

  it("says it is reading until the answer comes", async () => {
    const page = new Page();
    const release = page.requests.hold(AzureDevOpsNames.readPullRequestMethod);
    page.create();
    await page.requests.askedAsync(1);
    await page.untilAsync(() => page.text === "Reading the pull request on Azure DevOps.");
    const reading: string = page.text;

    release(pullRequest.toJson());
    await page.settleAsync();

    expect([reading, page.query("[role=status]")]).toEqual(["Reading the pull request on Azure DevOps.", null]);
    expect(page.texts(".title")).toEqual(["Export notes as Markdown from the shared notes list"]);
  });

  it("logs a request the window fails, offers to try again, and shows the pull request the retry reads", async () => {
    const page = new Page();
    page.requests.fail(AzureDevOpsNames.readPullRequestMethod, new WindowFailure("The runtime stopped."));
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    await page.openAsync();
    const failed: string = page.text;

    await page.clickAsync("Try again");

    expect(failed).toBe("error Azure DevOps didn't answer. Try again to read this pull request. Try again");
    expect(page.context.callsOf("log").map(t => t[0])).toEqual([
      "The Azure DevOps module's git-azure-devops.readPullRequest request failed: WindowFailure: The runtime stopped."]);
    expect(page.texts(".title")).toEqual(["Export notes as Markdown from the shared notes list"]);
  });

  it("rethrows a failure that isn't the window's while it reads", async () => {
    const page = new Page();
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    page.requests.fail(AzureDevOpsNames.readPullRequestMethod, new RangeError("Unexpected."));
    await page.openAsync();

    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("logs a link the window can't open, and rethrows a failure that isn't the window's", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    let calls = 0;
    page.context.answer("openLinkAsync", async () => {
      calls++;
      throw calls === 1 ? new WindowFailure("No browser.") : new RangeError("Unexpected.");
    });
    await page.openAsync();

    await page.clickAsync("Open in Azure DevOps");
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    await page.clickAsync("Open in Azure DevOps");

    expect(page.context.callsOf("log").map(t => t[0])).toEqual([`The Azure DevOps module couldn't open ${URL}: WindowFailure: No browser.`]);
    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("logs a link in the Pull request view that the window can't open, and rethrows a failure that isn't the window's", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    let calls = 0;
    page.context.answer("openLinkAsync", async () => {
      calls++;
      throw calls === 1 ? new WindowFailure("No browser.") : new RangeError("Unexpected.");
    });
    await page.openAsync();

    await page.clickAsync("Export notes as Markdown files");
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    await page.clickAsync("Export notes as Markdown files");

    expect(page.context.callsOf("log").map(t => t[0]))
      .toEqual(["The Azure DevOps module couldn't open https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/4821: WindowFailure: No browser."]);
    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("reads again for another document instance, and drops an answer for the one it left", async () => {
    const page = new Page();
    const release = page.requests.hold(AzureDevOpsNames.readPullRequestMethod);
    const other = new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 7);
    const otherItem = new HostItem(other, ReferenceKind.PullRequest, ReferenceState.Open, "Another change", URL, null, CREATED, null, 0,
      new HostChanges(null, null, null, "another-change", "main", "0123456789abcdef0123456789abcdef01234567"));
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(otherItem, [], [], [], false, "", null, []).toJson());
    page.create();
    await page.requests.askedAsync(1);

    page.fixture?.componentRef.setInput("instance", `fabrikam/${REPOSITORY}/7`);
    await page.untilAsync(() => page.texts(".title")[0] === "Another change");
    release(pullRequest.toJson());
    await page.settleAsync();

    expect([page.payloadsOf(AzureDevOpsNames.readPullRequestMethod), page.payloadsOf(AzureDevOpsNames.readMergeTypesMethod)]).toEqual([
      [reference.toJson(), other.toJson()], [other.toJson()]]);
    expect(page.texts(".title")).toEqual(["Another change"]);
  });

  it("drops a failure for a document instance it left", async () => {
    const page = new Page();
    const fail = page.requests.holdFailure(AzureDevOpsNames.readPullRequestMethod);
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.create(`fabrikam/${REPOSITORY}/7`);
    await page.requests.askedAsync(1);

    page.fixture?.componentRef.setInput("instance", INSTANCE);
    await page.untilAsync(() => page.texts(".title")[0] === "Export notes as Markdown from the shared notes list");
    fail(new WindowFailure("The runtime stopped."));
    await page.settleAsync();

    expect([page.query("[role=alert]"), page.texts(".title")]).toEqual([null, ["Export notes as Markdown from the shared notes list"]]);
  });

  it("opens a link in the description through the window, with the gesture that opened it", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(item, [], [], [], false, "See [the spec](https://example.com/spec).", 5, [])
      .toJson());
    page.context.answer("openLinkAsync", async () => undefined);
    await page.openAsync();
    await page.untilAsync(() => page.query(".description a") !== null);

    page.find(".description a").click();
    await page.settleAsync();

    expect(page.context.callsOf("openLinkAsync")).toEqual([["https://example.com/spec", { gesture: expect.anything() }]]);
  });

  it("shows the pull request's comments after its policies, and opens a link in a comment through the window", async () => {
    const page = new Page([new HostThread(3, ThreadStatus.Active, null, null,
      [new HostComment(1, null, new HostPerson("octocat@fabrikam.com", null, null), CREATED, "See [the spec](https://example.com/spec).")])]);
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.context.answer("openLinkAsync", async () => undefined);
    await page.openAsync();
    await page.untilAsync(() => page.query(".comment a") !== null);

    const sections = [...page.element.querySelectorAll(".column > *")].map(t => t.getAttribute("aria-label") ?? t.tagName.toLowerCase());
    page.find(".comment a").click();
    await page.settleAsync();

    expect(sections).toEqual(["Description", "nol-git-pull-request-threads"]);
    expect(page.context.callsOf("openLinkAsync")).toEqual([["https://example.com/spec", { gesture: expect.anything() }]]);
  });

  it("shows the Azure DevOps references in the description and comments as chips, opens a work item or pull request in the app, and others through the window",
    async () => {
      const page = new Page([new HostThread(3, ThreadStatus.Active, null, null,
        [new HostComment(1, null, new HostPerson("octocat@fabrikam.com", null, null), CREATED, "Also #4799.")])]);
      page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(item, [], [], [], false,
        `Fixes AB#4821, follows [!12](https://dev.azure.com/fabrikam/Web%20Site/_git/${REPOSITORY}/pullrequest/12) and https://dev.azure.com/contoso/_workitems/edit/3.`,
        5, []).toJson());
      page.context.answer("openLinkAsync", async () => undefined);
      await page.openAsync();
      await page.untilAsync(() => page.query(".comment a.nol-markdown-link") !== null);
      const links: HTMLAnchorElement[] = [...page.queryAll<HTMLAnchorElement>(".description a.nol-markdown-link, .comment a.nol-markdown-link")];

      for (const link of links)
        link.click();
      await page.settleAsync();

      expect(links.map(t => [t.matches("[nol-link-reference-chip]"), wordsOf(t)]))
        .toEqual([[true, "Work item 4821"], [true, "!12"], [true, "Work item 3"], [true, "Work item 4799"]]);
      expect(page.context.callsOf("openDocument")).toEqual([["git-azure-devops.workItems", "fabrikam/Web%20Site/4821", "My work items"],
        ["git-azure-devops.pullRequest", `fabrikam/${REPOSITORY}/12`, "!12"], ["git-azure-devops.workItems", "fabrikam/Web%20Site/4799", "My work items"]]);
      expect(page.links).toEqual(["https://dev.azure.com/contoso/_workitems/edit/3"]);
    });

  it("lists the votes Azure DevOps takes, sets the one chosen, and shows the answer in place of the person's reviewer entry", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.requests.answer(AzureDevOpsNames.voteMethod, new HostReviewer(new HostPerson("monalisa@fabrikam.com", null, null), 1, "Approved", false).toJson());
    await page.openAsync();

    const choices: string[] = await page.voteAsync("Approve");
    await page.untilAsync(() => page.query(".vote-confirm") !== null);
    const confirm: string[] = page.texts(".vote-confirm");
    const asked: boolean = page.requests.methods.includes(AzureDevOpsNames.voteMethod);
    await page.clickAsync("Approve anyway");

    expect([confirm, asked, page.query(".vote-confirm")]).toEqual([
      ["This pull request completes by itself once its policies pass, so this approval may merge it at once. Cancel Approve anyway"], false, null]);
    expect(choices).toEqual(["Approve", "Approve with suggestions", "Wait for author", "Reject", "Reset vote"]);
    expect(page.texts(".vote-note")).toEqual(["Your vote: Approved. Votes and comments go to Azure DevOps as you."]);
    expect([page.requests.methods.at(-1), page.requests.payloads.at(-1)]).toEqual([AzureDevOpsNames.voteMethod, { reference: reference.toJson(), vote: 10 }]);
    expect(page.texts(".reviewer").at(-1)).toBe("M check monalisa@fabrikam.com Approved");
    expect([page.queryAll(".vote.approved").length, page.queryAll(".vote.waiting").length,
      page.queryAll(".vote.rejected").length]).toEqual([2, 1, 0]);
  });

  it("approves from the footer's Approve, and says the person's vote is none yet until they vote", async () => {
    const page = new Page([], HostSignIn.signedIn(new HostAccount("Hubot@Fabrikam.com", null, null, [])));
    const reviewers = [new HostReviewer(new HostPerson("hubot@fabrikam.com", null, null), 0, "No vote", false)];
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(item, reviewers, [], [], false, "", 5, []).toJson());
    page.requests.answer(AzureDevOpsNames.voteMethod, new HostReviewer(new HostPerson("hubot@fabrikam.com", null, null), 1, "Approved", false).toJson());
    await page.openAsync();
    const before: string[] = page.texts(".vote-note");

    await page.clickAsync("Approve");
    await page.untilAsync(() => page.texts(".vote-note")[0] !== before[0]);

    expect([before, page.texts(".vote-note"), page.payloadsOf(AzureDevOpsNames.voteMethod)]).toEqual([
      ["Your vote: none yet. Votes and comments go to Azure DevOps as you."], ["Your vote: Approved. Votes and comments go to Azure DevOps as you."],
      [{ reference: reference.toJson(), vote: 10 }]]);
  });

  it("leaves the vote out of the footer when signed out", async () => {
    const page = new Page([], HostSignIn.signedOut());
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    await page.openAsync();

    expect(page.texts(".vote-note")).toEqual(["Votes and comments go to Azure DevOps as you."]);
  });

  it("logs a sign-in read the window fails and leaves the vote out of the footer", async () => {
    const page = new Page([], new WindowFailure("The runtime stopped."));
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    await page.openAsync();

    expect([page.texts(".vote-note"), page.context.callsOf("log").map(t => t[0])]).toEqual([["Votes and comments go to Azure DevOps as you."],
      ["The Azure DevOps module's git-azure-devops.readSignIn request failed: WindowFailure: The runtime stopped."]]);
  });

  it("rethrows a sign-in read's failure that isn't the window's", async () => {
    const page = new Page([], new RangeError("Unexpected."));
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    page.create("fabrikam/482");

    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("shows the Complete panel in the view for an open pull request, and reads the pull request again once it completes, with no panel once merged", async () => {
    const page = new Page();
    const merged = new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Merged, item.title, URL, null, CREATED, CREATED, 0, item.changes);
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(item, [], [], [], false, "", 5, []).toJson(),
      new HostPullRequest(merged, [], [], [], false, "", 5, []).toJson());
    page.requests.answer(AzureDevOpsNames.completePullRequestMethod, null);
    await page.openAsync();
    await page.untilAsync(() => page.query(".complete-merge:not([disabled])") !== null);
    const panel: boolean = page.detail.querySelector("nol-git-azure-devops-complete") !== null;

    await page.clickAsync("Complete merge");
    page.find(".confirm-action").click();
    await page.untilAsync(() => page.query(".page") !== null && page.query("nol-git-azure-devops-complete") === null);

    expect([panel, page.payloadsOf(AzureDevOpsNames.readPullRequestMethod).length]).toEqual([true, 2]);
  });

  it("sets auto-complete from the view's Complete panel after its one confirm, then reads the pull request again and offers to cancel it there, the footer keeping"
    + " only the vote", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, opened.toJson(), new HostPullRequest(item, [], [], [], true, "", 5, []).toJson());
    page.requests.answer(AzureDevOpsNames.setAutoCompleteMethod, null);
    await page.openAsync();
    await page.untilAsync(() => page.query(".set-auto-complete:not([disabled])") !== null);

    page.find(".set-auto-complete").click();
    await page.settleAsync();
    const confirm: string[] = page.texts(".complete-panel .confirm-text");
    page.find(".confirm-action").click();
    await page.untilAsync(() => page.query(".cancel-auto-complete") !== null);
    const footer: Element | null = page.element.querySelector(".set-auto-complete, .cancel-auto-complete");

    expect([footer, page.detail.querySelector(".complete-panel .cancel-auto-complete") !== null]).toEqual([null, true]);
    expect(confirm).toEqual(["Set !482 to complete by itself with Merge, no fast-forward into main once its policies pass, then deletes users/monalisa/4821-export-notes? "
      + "Azure DevOps then merges it as you, without asking again."]);
    expect([page.payloadsOf(AzureDevOpsNames.setAutoCompleteMethod).length, page.payloadsOf(AzureDevOpsNames.readPullRequestMethod).length,
      page.query(".set-auto-complete")]).toEqual([1, 2, null]);
  });

  it("holds Set auto-complete while the panel's message is blank, and shows none once the pull request merges", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, opened.toJson(), merged.toJson());
    page.requests.answer(AzureDevOpsNames.completePullRequestMethod, null);
    await page.openAsync();
    await page.untilAsync(() => page.query(".set-auto-complete:not([disabled])") !== null);

    const message = page.find(".message");
    if (!(message instanceof HTMLTextAreaElement))
      throw new Error("No message field is shown.");
    message.value = " ";
    message.dispatchEvent(new Event("input"));
    await page.settleAsync();
    const held: boolean = page.find(".set-auto-complete").hasAttribute("disabled");
    message.value = "Merged PR 482";
    message.dispatchEvent(new Event("input"));
    await page.settleAsync();
    await page.clickAsync("Complete merge");
    page.find(".confirm-action").click();
    await page.untilAsync(() => page.query(".page") !== null && page.query("nol-git-azure-devops-complete") === null);

    expect([held, page.query(".set-auto-complete, .cancel-auto-complete")]).toEqual([true, null]);
  });

  it("pulls the target branch in the folder the person named once the pull request reads as merged, and says it pulled", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, opened.toJson(), merged.toJson());
    page.requests.answer(AzureDevOpsNames.completePullRequestMethod, null);
    page.requests.answer(GitNames.statusMethod, cloneStatus(), cloneStatus());
    page.requests.answer(GitNames.pullMethod, null);

    await page.completeWithPullAsync();
    await page.untilAsync(() => page.query(".pull-note") !== null);

    expect([page.texts(".pull-note"), page.payloadsOf(GitNames.pullMethod), page.query(".pull-failure")]).toEqual([["Pulled main here."],
      [new GitPullParams("/work/site", "f-main").toJson()], null]);
  });

  it("pulls nothing when Azure DevOps hasn't merged the pull request yet, and says so", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, opened.toJson(), opened.toJson());
    page.requests.answer(AzureDevOpsNames.completePullRequestMethod, null);
    page.requests.answer(GitNames.statusMethod, cloneStatus(), cloneStatus());

    await page.completeWithPullAsync();
    await page.untilAsync(() => page.query(".pull-note") !== null);

    expect([page.texts(".pull-note"), page.requests.methods.includes(GitNames.pullMethod)]).toEqual([["Azure DevOps hasn't merged it yet, so main wasn't pulled here."],
      false]);
  });

  it.each([["is on another branch", cloneStatus("feature")],
    ["no longer tracks the target branch", cloneStatus("main", "origin/release")]] as const)("pulls nothing when the folder %s since Complete merge, and says so", async (_, status) => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, opened.toJson(), merged.toJson());
    page.requests.answer(AzureDevOpsNames.completePullRequestMethod, null);
    page.requests.answer(GitNames.statusMethod, cloneStatus(), status);

    await page.completeWithPullAsync();
    await page.untilAsync(() => page.query(".pull-failure") !== null);

    expect([page.texts(".pull-failure"), page.requests.methods.includes(GitNames.pullMethod)]).toEqual([["error The folder isn't on main any more, so it wasn't pulled."],
      false]);
  });

  it("pulls nothing when the open folder changed since Complete merge, and says so", async () => {
    const page = new Page();
    const folder = signal<string | null>("/work/site");
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), folder));
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, opened.toJson(), merged.toJson());
    const release = page.requests.hold(AzureDevOpsNames.completePullRequestMethod);
    page.requests.answer(GitNames.statusMethod, cloneStatus(), cloneStatus());
    await page.openAsync();
    await page.untilAsync(() => page.query(".pull-after") !== null && page.query(".complete-merge:not([disabled])") !== null);

    page.find(".pull-after input").click();
    await page.settleAsync();
    await page.clickAsync("Complete merge");
    page.find(".confirm-action").click();
    await page.untilAsync(() => page.query(".complete-merge[disabled]") !== null);
    folder.set("/work/other");
    release(null);
    await page.untilAsync(() => page.query(".pull-failure") !== null);

    expect([page.texts(".pull-failure"), page.requests.methods.includes(GitNames.pullMethod)]).toEqual([
      ["error The open folder changed since Complete merge, so main wasn't pulled."], false]);
  });

  it.each([["the runtime's sentence", new RuntimeRequestException(FailureCode.Conflict, "Pull failed: local changes would be overwritten."),
    "error Pull failed: local changes would be overwritten."], ["that Git didn't answer", new WindowFailure("The runtime stopped."),
    "error Git didn't answer, so main may not be pulled here."]] as const)("shows %s when the pull fails, never pulling again by itself", async (_, error, shown) => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, opened.toJson(), merged.toJson());
    page.requests.answer(AzureDevOpsNames.completePullRequestMethod, null);
    page.requests.answer(GitNames.statusMethod, cloneStatus(), cloneStatus());
    page.requests.fail(GitNames.pullMethod, error);

    await page.completeWithPullAsync();
    await page.untilAsync(() => page.query(".pull-failure") !== null);

    expect([page.texts(".pull-failure"), page.payloadsOf(GitNames.pullMethod).length, page.context.callsOf("log").map(t => t[0])]).toEqual([[shown], 1,
      [`The Azure DevOps module's git.pull request failed: ${String(error)}`]]);
  });

  it("drops a pull's outcome once the page shows another pull request", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, opened.toJson(), merged.toJson(), otherPullRequest(ReferenceState.Open).toJson());
    page.requests.answer(AzureDevOpsNames.completePullRequestMethod, null);
    page.requests.answer(GitNames.statusMethod, cloneStatus(), cloneStatus(), cloneStatus());
    const release = page.requests.hold(GitNames.pullMethod);

    await page.completeWithPullAsync();
    await page.untilAskedAsync(GitNames.pullMethod, 1);
    page.fixture?.componentRef.setInput("instance", `fabrikam/${REPOSITORY}/7`);
    await page.untilAsync(() => page.texts(".title")[0] === "Another change");
    release(null);
    await page.settleAsync();

    expect([page.query(".pull-note"), page.query(".pull-failure")]).toEqual([null, null]);
  });

  it("pulls nothing for a pull request the page left before its read after Complete merge came", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, opened.toJson());
    const release = page.requests.hold(AzureDevOpsNames.readPullRequestMethod);
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, otherPullRequest(ReferenceState.Merged).toJson());
    page.requests.answer(AzureDevOpsNames.completePullRequestMethod, null);
    page.requests.answer(GitNames.statusMethod, cloneStatus());

    await page.completeWithPullAsync();
    await page.untilAskedAsync(AzureDevOpsNames.readPullRequestMethod, 2);
    page.fixture?.componentRef.setInput("instance", `fabrikam/${REPOSITORY}/7`);
    await page.untilAsync(() => page.texts(".title")[0] === "Another change");
    release(merged.toJson());
    await page.settleAsync();

    expect([page.payloadsOf(GitNames.statusMethod).length, page.requests.methods.includes(GitNames.pullMethod), page.query(".pull-note")])
      .toEqual([1, false, null]);
  });

  it("rethrows a pull's failure that isn't the window's", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, opened.toJson(), merged.toJson());
    page.requests.answer(AzureDevOpsNames.completePullRequestMethod, null);
    page.requests.answer(GitNames.statusMethod, cloneStatus(), cloneStatus());
    page.requests.fail(GitNames.pullMethod, new RangeError("Unexpected."));
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();

    await page.completeWithPullAsync();

    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("shows no Complete panel for a draft", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Draft,
      item.title, URL, null, CREATED, null, 0, item.changes), [], [], [], false, "", 5, []).toJson());
    await page.openAsync();

    expect([page.query("nol-git-azure-devops-complete"), page.requests.methods.includes(AzureDevOpsNames.readMergeTypesMethod)]).toEqual([null, false]);
  });

  it("sends a vote that doesn't approve an auto-completing pull request at once, and sets no approval the person cancels or leaves", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.requests.answer(AzureDevOpsNames.voteMethod, new HostReviewer(new HostPerson("monalisa@fabrikam.com", null, null), -1, "Rejected", false).toJson());
    await page.openAsync();

    await page.voteAsync("Approve with suggestions");
    await page.untilAsync(() => page.query(".vote-confirm") !== null);
    await page.clickAsync("Cancel");
    const cancelled: boolean = page.query(".vote-confirm") === null;
    await page.voteAsync("Reject");
    await page.settleAsync();
    const rejected: boolean = page.query(".vote-confirm") === null;
    await page.voteAsync("Approve");
    await page.untilAsync(() => page.query(".vote-confirm") !== null);
    page.fixture?.componentRef.setInput("instance", `fabrikam/${REPOSITORY}/7`);
    await page.settleAsync();

    expect([cancelled, rejected, page.query(".vote-confirm")]).toEqual([true, true, null]);
    expect(page.requests.payloads.filter(t => typeof t === "object" && t !== null && "vote" in t)).toEqual([{ reference: reference.toJson(), vote: -10 }]);
  });

  it("adds the person under Reviewers when they weren't one, and holds the menu while the vote runs", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(item, [], [], [], false, "", 5, []).toJson());
    const release = page.requests.hold(AzureDevOpsNames.voteMethod);
    await page.openAsync();

    await page.voteAsync("Wait for author");
    await page.untilAsync(() => page.find(".vote-menu").hasAttribute("disabled"));
    const held: boolean = page.find(".vote-menu").hasAttribute("disabled");
    release(new HostReviewer(new HostPerson("octocat@fabrikam.com", null, null), -0.5, "Waiting for the author", false).toJson());
    await page.untilAsync(() => !page.find(".vote-menu").hasAttribute("disabled"));

    expect([held, page.requests.payloads.at(-1)]).toEqual([true, { reference: reference.toJson(), vote: -5 }]);
    expect(page.texts(".reviewer")).toEqual(["O schedule octocat@fabrikam.com Waiting for the author"]);
  });

  it("shows the runtime's sentence, or that Azure DevOps didn't answer, beside the menu, and clears it on the next vote", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    const cannotVote = "The Azure DevOps token can't vote on pull requests; it needs the Code (Read & write) scope.";
    page.requests.fail(AzureDevOpsNames.voteMethod, new RuntimeRequestException(FailureCode.Unauthorized, cannotVote));
    page.requests.fail(AzureDevOpsNames.voteMethod, new WindowFailure("The runtime stopped."));
    page.requests.answer(AzureDevOpsNames.voteMethod, new HostReviewer(new HostPerson("monalisa@fabrikam.com", null, null), 0, "No vote", false).toJson());
    await page.openAsync();

    await page.voteAsync("Reject");
    await page.untilAsync(() => page.query(".vote-failure") !== null);
    const refused: string[] = page.texts(".vote-failure");
    await page.voteAsync("Reset vote");
    await page.untilAsync(() => page.texts(".vote-failure")[0] !== refused[0]);
    const unanswered: string[] = page.texts(".vote-failure");
    await page.voteAsync("Reset vote");
    await page.untilAsync(() => page.query(".vote-failure") === null);

    expect([refused, unanswered]).toEqual([[`error ${cannotVote}`], ["error Azure DevOps didn't answer, so nothing changed. Try again."]]);
  });

  it.each([["answer", false], ["failure", true]] as const)("drops a vote's %s for a document instance it left", async (_, isFailure) => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    const read = page.requests.hold(AzureDevOpsNames.readPullRequestMethod);
    let finish: () => void;
    if (isFailure) {
      const fail = page.requests.holdFailure(AzureDevOpsNames.voteMethod);
      finish = () => fail(new WindowFailure("The runtime stopped."));
    }
    else {
      const release = page.requests.hold(AzureDevOpsNames.voteMethod);
      finish = () => release(new HostReviewer(new HostPerson("monalisa@fabrikam.com", null, null), 1, "Approved", false).toJson());
    }
    await page.openAsync();

    await page.voteAsync("Reject");
    page.fixture?.componentRef.setInput("instance", `fabrikam/${REPOSITORY}/7`);
    await page.untilAsync(() => page.query("[role=status]") !== null);
    finish();
    read(pullRequest.toJson());
    await page.untilAsync(() => page.query(".page") !== null);

    expect([page.texts(".reviewer").at(-1), page.query(".vote-failure"), page.find(".vote-menu").hasAttribute("disabled")])
      .toEqual(["M close monalisa@fabrikam.com Rejected", null, false]);
  });

  it("opens a search under Reviewers from its button, lists the reviewer it adds and closes, and closes on another click or document", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(item, [], [], [], false, "", 5, []).toJson(), pullRequest.toJson());
    page.requests.answer(AzureDevOpsNames.searchPeopleMethod, [{ descriptor: "aad.TW9uYQ", name: "Mona Lisa", login: "monalisa@fabrikam.com", isGroup: false }]);
    page.requests.answer(AzureDevOpsNames.addReviewerMethod, new HostReviewer(new HostPerson("monalisa@fabrikam.com", null, null), 0, "No vote", false).toJson());
    await page.openAsync();
    const button = (): HTMLElement => page.find(".add-reviewer");

    button().click();
    await page.settleAsync();
    const opened: string | null = button().getAttribute("aria-pressed");
    const field = page.find("nol-git-azure-devops-add-reviewer input");
    if (!(field instanceof HTMLInputElement))
      throw new Error("No search field is shown.");
    field.value = "mon";
    field.dispatchEvent(new Event("input"));
    await page.settleAsync();
    page.find("nol-git-azure-devops-add-reviewer .person").click();
    await page.untilAsync(() => page.query("nol-git-azure-devops-add-reviewer") === null);
    const reviewers: string[] = page.texts(".reviewer");
    button().click();
    await page.settleAsync();
    button().click();
    await page.settleAsync();
    const closed: boolean = page.query("nol-git-azure-devops-add-reviewer") === null;
    button().click();
    await page.settleAsync();
    page.fixture?.componentRef.setInput("instance", `fabrikam/${REPOSITORY}/7`);
    await page.untilAsync(() => page.query("nol-git-azure-devops-add-reviewer") === null);
    await page.untilAsync(() => page.query(".page") !== null);

    expect([opened, reviewers, closed, page.query("nol-git-azure-devops-add-reviewer"), button().getAttribute("aria-pressed")])
      .toEqual(["true", ["M monalisa@fabrikam.com No vote yet · optional"], true, null, "false"]);
  });

  it("closes the search when it asks to", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    await page.openAsync();

    page.find(".add-reviewer").click();
    await page.settleAsync();
    page.find("nol-git-azure-devops-add-reviewer input").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await page.settleAsync();

    expect([page.query("nol-git-azure-devops-add-reviewer"), page.find(".add-reviewer").getAttribute("aria-pressed")]).toEqual([null, "false"]);
  });

  it("rethrows a vote's failure that isn't the window's", async () => {
    const page = new Page();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    page.requests.fail(AzureDevOpsNames.voteMethod, new RangeError("Unexpected."));
    await page.openAsync();
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();

    await page.voteAsync("Reject");
    await page.settleAsync();

    expect(await rejection).toEqual(new RangeError("Unexpected."));
  });

  describe("Go to line on a comment thread", () => {
    const COMMON: string = "fedcba9876543210fedcba9876543210fedcba98";
    const thread: HostThread = new HostThread(5, ThreadStatus.Active, "/src/app.ts", 41,
      [new HostComment(1, null, new HostPerson("octocat@fabrikam.com", null, null), CREATED, "Is this the right default?")]);
    const threadPage: string = `${URL}?_a=files&path=%2Fsrc%2Fapp.ts&discussionId=5`;
    const appDiff: GitDiff = new GitDiff([new DiffFile("src/app.ts", undefined, "src/app.ts", undefined, FileChange.Modified, null, null, false, null,
      [new DiffHunk(40, 1, 40, 2, "", [new DiffLine(LineKind.Context, 40, 40, "const a = 1;"), new DiffLine(LineKind.Added, null, 41, "const b = 2;")])], false)],
    0, 0, false);

    /** A page whose open repository is the pull request's, with the push's commits, so its Files tab shows the changes from local Git as `diff` holds them. */
    function cloned(diff: GitDiff): Page {
      onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/site")));
      const page = new Page([thread]);
      page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
      page.requests.answer(AzureDevOpsNames.readPullRequestChangesMethod, new HostPullRequestFiles(COMMIT, COMMON, [new HostPullRequestFile("src/app.ts",
        FileChangeKind.Modified, null)], false).toJson());
      page.requests.otherwise(GitNames.statusMethod, cloneStatus());
      page.requests.answer(GitNames.commitDetailMethod, {}, {});
      page.requests.answer(GitNames.diffMethod, diff.toJson());
      page.context.answer("openLinkAsync", async () => undefined);
      return page;
    }

    it("shows the thread's line in the Files tab's changes from local Git when the open repository is the pull request's", async () => {
      const page = cloned(appDiff);
      await page.openAsync();
      await page.untilAsync(() => page.query(".go-to-line") !== null);

      await page.clickAsync("Go to line");
      await page.untilAsync(() => page.query(".marked-line") !== null);

      expect([page.texts(".tab.on"), page.queryAll(".marked-line").map(t => t.textContent), page.links]).toEqual([["Files 1"], ["+const b = 2;"], []]);
    });

    it("opens the thread on Azure DevOps when the changes from local Git don't hold its file", async () => {
      const page = cloned(new GitDiff([], 0, 0, false));
      await page.openAsync();
      await page.untilAsync(() => page.query(".go-to-line") !== null);

      await page.clickAsync("Go to line");
      await page.untilAsync(() => page.links.length > 0);

      expect([page.texts(".tab.on"), page.links]).toEqual([["Files 1"], [threadPage]]);
    });

    it("opens the thread on Azure DevOps when no repository of the pull request's is open", async () => {
      const away = new Page([thread]);
      away.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
      away.context.answer("openLinkAsync", async () => undefined);
      await away.openAsync();
      await away.untilAsync(() => away.query(".go-to-line") !== null);

      await away.clickAsync("Go to line");
      await away.untilAsync(() => away.links.length > 0);

      expect([away.texts(".tab.on"), away.links, away.query("nol-git-pull-request-files")]).toEqual([["Overview"], [threadPage], null]);
    });

    it("does nothing for a Go to line whose repository check ends after the page shows another pull request", async () => {
      onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/site")));
      const page = new Page([thread]);
      page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson(), otherPullRequest(ReferenceState.Open).toJson());
      page.requests.otherwise(GitNames.statusMethod, cloneStatus());
      page.context.answer("openLinkAsync", async () => undefined);
      await page.openAsync();
      await page.untilAsync(() => page.query(".go-to-line") !== null);
      const checked: number = page.payloadsOf(GitNames.statusMethod).length;
      const release = page.requests.hold(GitNames.statusMethod);
      page.find(".go-to-line").click();
      await page.untilAskedAsync(GitNames.statusMethod, checked + 1);

      page.fixture?.componentRef.setInput("instance", `fabrikam/${REPOSITORY}/7`);
      await page.untilAsync(() => page.texts(".title")[0] === "Another change");
      release(cloneStatus());
      await Promise.allSettled(page.requests.answered);
      await page.settleAsync();

      expect([page.texts(".tab.on"), page.links, page.query("nol-git-pull-request-files")]).toEqual([["Overview"], [], null]);
    });

    it("opens nothing for a line the Files tab couldn't show when no Go to line waits for it", async () => {
      const page = cloned(appDiff);
      await page.openAsync();
      await page.clickAsync("Files");
      await page.untilAsync(() => page.query("nol-git-pull-request-files") !== null);
      const files: GitPullRequestFilesComponent = page.fixture?.debugElement.query(By.directive(GitPullRequestFilesComponent))?.componentInstance;

      files.unrevealed.emit(new GitFileLine("src/app.ts", 41));
      await page.settleAsync();

      expect([page.texts(".tab.on"), page.links]).toEqual([["Files 1"], []]);
    });
  });
});
