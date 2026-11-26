/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EnvironmentInjector, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { CheckState, HostBuild, HostChanges, HostItem, HostPerson, HostPolicy, HostPullRequest, HostReference, HostReviewer, HostWorkItemLink, HostWorkItemType,
  PolicyState, ReferenceKind, ReferenceState, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { AzureDevOpsPullRequestDetailComponent }
  from "../../../../src/app/components/azure-devops-pull-request-detail/azure-devops-pull-request-detail.component.ts";
import { PullRequestChoice } from "../../../../src/app/models/pull-request-choice.ts";
import { PullRequestSelection } from "../../../../src/app/services/pull-request-selection.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const CREATED: number = Date.UTC(2026, 10, 20, 12);
const URL: string = "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/752";
const ITEM_URL: string = "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/7521";

function itemOf(number: number, changes: HostChanges): HostItem {
  return new HostItem(new HostReference("git-azure-devops", "fabrikam", "3f2504e0-4f89-11d3-9a0c-0305e82c3301", number), ReferenceKind.PullRequest,
    ReferenceState.Merged, "Export notes as Markdown files", URL, null, CREATED, CREATED, 0, changes);
}

const changes: HostChanges = HostChanges.uncounted("users/monalisa/7521-export-notes", "main", "0123456789abcdef0123456789abcdef01234567");
const full: HostPullRequest = new HostPullRequest(itemOf(752, changes), [
  new HostReviewer(new HostPerson("octocat@fabrikam.test", null, null), 0.5, "Approved with suggestions", true),
  new HostReviewer(new HostPerson("hubot@fabrikam.test", null, null), -0.5, "Waiting for the author", false),
  new HostReviewer(new HostPerson("[Web Site]\\Web Team", null, null), 0, "No vote", false),
  new HostReviewer(new HostPerson("monalisa@fabrikam.test", null, null), -1, "Rejected", false)
], [
  new HostPolicy("Minimum number of reviewers", PolicyState.Approved, true, null),
  new HostPolicy("Comment requirements", PolicyState.Rejected, true, null),
  new HostPolicy("Work item linking", PolicyState.Approved, false, null)
], [
  new HostBuild("site-ci", CheckState.Succeeded, "https://dev.azure.com/fabrikam/web/_build/results?buildId=7", CREATED, CREATED + 372_000),
  new HostBuild("lint", CheckState.Running, null, CREATED, null),
  new HostBuild("clock skew", CheckState.Running, null, CREATED + 600_000, null),
  new HostBuild("dependency scan", CheckState.Queued, null, null, null)
], false, "", 5, [
  new HostWorkItemLink(7521, "Export notes as Markdown files", new HostWorkItemType("User Story", "009CCC", "icon_book"), "Active", WorkItemCategory.InProgress,
    ITEM_URL)
]);
const bare: HostPullRequest = new HostPullRequest(itemOf(7, changes), [], [new HostPolicy("Work item linking", PolicyState.Approved, false, null)], [], false, "",
  null, []);

function wordsOf(node: Element): string {
  return (node.textContent ?? "").replace(/\s+/gu, " ").trim();
}

class View {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context).ignore(AzureDevOpsNames.readPersonAvatarMethod);
  public readonly choice: WritableSignal<PullRequestChoice | null> = signal(null);
  public readonly added: HostReviewer[] = [];
  public readonly fixture: ComponentFixture<AzureDevOpsPullRequestDetailComponent>;

  public constructor() {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    PullRequestSelection.of(this.context).follow(this.choice, signal(true), TestBed.inject(EnvironmentInjector));
    this.fixture = TestBed.createComponent(AzureDevOpsPullRequestDetailComponent);
    this.fixture.componentRef.setInput("instance", "selected");
    this.fixture.autoDetectChanges();
  }

  public get element(): HTMLElement {
    const element: unknown = this.fixture.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The view isn't open.");
    return element;
  }

  public texts(selector: string): readonly string[] {
    return [...this.element.querySelectorAll(selector)].map(wordsOf);
  }

  public show(pullRequest: HostPullRequest, readAt: number = CREATED + 65_000): void {
    this.choice.set(new PullRequestChoice(pullRequest, pullRequest.reviewers, readAt, { changed: () => undefined, added: t => this.added.push(t) }));
  }

  public async clickAsync(selector: string): Promise<void> {
    const found = this.element.querySelector(selector);
    if (!(found instanceof HTMLElement))
      throw new Error(`The view has no ${selector}.`);
    found.click();
    await this.settleAsync();
  }

  public async settleAsync(): Promise<void> {
    await this.fixture.whenStable();
    this.fixture.detectChanges();
    await this.fixture.whenStable();
  }
}

describe("AzureDevOpsPullRequestDetailComponent", () => {
  it("draws a linked work item's type icon as Azure DevOps drew it, named by its type and 0.875 of the symbol it stands in for", async () => {
    const svg: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#009CCC" d="M2 2h12v12H2z"/></svg>';
    const drawn = (type: HostWorkItemType): HostPullRequest => new HostPullRequest(itemOf(7, changes), [], [], [], false, "", null, [
      new HostWorkItemLink(7521, "Export notes as Markdown files", type, "Active", WorkItemCategory.InProgress, ITEM_URL)]);
    const view: View = new View();
    view.show(drawn(new HostWorkItemType("User Story", "009CCC", "icon_book", svg)));
    await view.settleAsync();
    const image = view.element.querySelector<HTMLImageElement>(".list .row img.type-image");
    const imageBox = image?.getBoundingClientRect();
    view.show(drawn(new HostWorkItemType("User Story", "009CCC", "icon_book")));
    await view.settleAsync();
    const symbolBox = view.element.querySelector<HTMLElement>(".list .row .material-symbols-rounded")?.getBoundingClientRect();

    expect([image?.getAttribute("src"), image?.alt]).toEqual([`data:image/svg+xml,${encodeURIComponent(svg)}`, "User Story"]);
    expect([imageBox?.width, imageBox?.height]).toEqual([(symbolBox?.width ?? 0) * 0.875, (symbolBox?.width ?? 0) * 0.875]);
    expect(imageBox?.width).toBeGreaterThan(0);
  });

  it("says to open a pull request while none is shown, and titles its view plainly", async () => {
    const view: View = new View();
    await view.settleAsync();

    expect([wordsOf(view.element), view.context.callsOf("updateView").at(-1)]).toEqual(["Open a pull request to see its details here.",
      ["git-azure-devops.pullRequestDetail", "selected", { title: "Pull request" }]]);
  });

  it("titles its view for the pull request it shows, and marks each reviewer's vote: approved, waiting, none or rejected", async () => {
    const view: View = new View();
    view.show(full);
    await view.settleAsync();

    expect(view.context.callsOf("updateView").at(-1)).toEqual(["git-azure-devops.pullRequestDetail", "selected", { title: "Pull request !752" }]);
    expect([...view.element.querySelectorAll(".reviewer")].map(t => wordsOf(t.querySelector(".vote") ?? document.createElement("span"))))
      .toEqual(["check", "schedule", "", "close"]);
    expect([view.element.querySelectorAll(".vote.approved").length, view.element.querySelectorAll(".vote.waiting").length,
      view.element.querySelectorAll(".vote.rejected").length, view.element.querySelectorAll(".group-avatar").length]).toEqual([1, 1, 1, 1]);
  });

  it("sums the required policies against the target branch, leaving out optional ones", async () => {
    const view: View = new View();
    view.show(full);
    await view.settleAsync();

    expect(view.texts(".card-head .small")).toEqual(["1 of 2 required passed · branch main"]);
  });

  it("times a finished build from start to finish and a running one up to when it was read, never below zero, and none that hasn't started", async () => {
    const view: View = new View();
    view.show(full);
    await view.settleAsync();

    expect(view.texts("div.row .grow")).toEqual(["site-ci · 6 min 12 s", "lint · 1 min 5 s so far", "clock skew · 0 min 0 s so far", "dependency scan"]);
  });

  it("shows no summary without required policies, and says each list is empty", async () => {
    const view: View = new View();
    view.show(bare);
    await view.settleAsync();

    expect([view.texts(".card-head .small"), view.texts("section p")]).toEqual([[], ["No reviewers.", "No builds.", "No linked work items."]]);
  });

  it("opens and closes the reviewer search from its button, and closes it when another pull request shows", async () => {
    const view: View = new View();
    view.show(full);
    await view.settleAsync();

    await view.clickAsync(".add-reviewer");
    const opened: boolean = !Object.isNull(view.element.querySelector("nol-git-azure-devops-add-reviewer"));
    await view.clickAsync(".add-reviewer");
    const closed: boolean = Object.isNull(view.element.querySelector("nol-git-azure-devops-add-reviewer"));
    await view.clickAsync(".add-reviewer");
    view.show(bare);
    await view.settleAsync();

    expect([opened, closed, view.element.querySelector("nol-git-azure-devops-add-reviewer")]).toEqual([true, true, null]);
  });

  it("opens a build and a work item through the window, logs a link the window can't open, and rethrows a failure that isn't the window's", async () => {
    const view: View = new View();
    let calls: number = 0;
    view.context.answer("openLinkAsync", async () => {
      calls++;
      if (calls === 2)
        throw new WindowFailure("No browser.");
      if (calls === 3)
        throw new RangeError("Unexpected.");
    });
    view.show(full);
    await view.settleAsync();

    await view.clickAsync("div.row button[nol-icon-button]");
    await view.clickAsync("button.row");
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    await view.clickAsync("button.row");

    expect([view.context.callsOf("openLinkAsync").map(t => t[0]), view.context.callsOf("log").map(t => t[0])]).toEqual([
      ["https://dev.azure.com/fabrikam/web/_build/results?buildId=7", ITEM_URL, ITEM_URL],
      [`The Azure DevOps module couldn't open ${ITEM_URL}: WindowFailure: No browser.`]]);
    expect(await rejection).toBeInstanceOf(RangeError);
  });
});
