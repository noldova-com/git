/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException, WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostChanges, HostItem, HostPerson, HostPolicy, HostPullRequest, HostReference, HostWorkItemLink, HostWorkItemType, PolicyState, ReferenceKind,
  ReferenceState, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { GitNames, GitRemote, GitStatus, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";
import { GitFolder } from "@noldova/git.window";
import { describe, expect, it, onTestFinished } from "vitest";

import { AzureDevOpsCompleteComponent } from "../../../../src/app/components/azure-devops-complete/azure-devops-complete.component.ts";
import type { PullAfter } from "../../../../src/app/types/pull-after.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const URL: string = "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/752";
const COMMIT: string = "0123456789abcdef0123456789abcdef01234567";
const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 752);
const changes: HostChanges = HostChanges.uncounted("users/monalisa/7521-export-notes", "main", COMMIT);
const story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");
const ALL: JsonValue = ["noFastForward", "squash", "rebase", "rebaseMerge"];

function pullRequestOf(number: number = 752, policies: readonly HostPolicy[] = [], workItems: readonly number[] = [7521, 7499], isAutoComplete: boolean = false):
  HostPullRequest {
  const item = new HostItem(new HostReference("git-azure-devops", "fabrikam", REPOSITORY, number), ReferenceKind.PullRequest, ReferenceState.Open,
    "Export notes as Markdown files", URL, new HostPerson("monalisa@fabrikam.com", null, null), 1_800_000_000_000, null, 0, changes);
  return new HostPullRequest(item, [], policies, [], isAutoComplete, "", 5, workItems.map(t => new HostWorkItemLink(t, "Export notes", story, "Active", WorkItemCategory.InProgress, URL)));
}

function statusOf(branch: string, path: string, upstream: StatusUpstream | null = new StatusUpstream("origin/main", 0, 2, false)): JsonValue {
  return new GitStatus(branch, COMMIT, upstream, [], false, `${branch}-${path}`, null, new GitRemote("origin", "dev.azure.com", path, RemoteTransport.Https)).toJson();
}

function wordsOf(node: Node): string {
  const words: string[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); !Object.isNull(text); text = walker.nextNode())
    words.push((text.textContent ?? "").trim());
  return words.filter(t => t.length > 0).join(" ").replace(/\s+/g, " ");
}

@Component({
  selector: "nol-git-azure-devops-complete-host",
  imports: [AzureDevOpsCompleteComponent],
  template: "<nol-git-azure-devops-complete [pullRequest]=\"pullRequest()\" [changes]=\"changes\" (changed)=\"changed($event)\" />"
})
class HostComponent {
  public readonly pullRequest: WritableSignal<HostPullRequest> = signal<HostPullRequest>(pullRequestOf());
  public readonly changes: HostChanges = changes;
  public readonly completions: WritableSignal<number> = signal<number>(0);
  public readonly pulls: (PullAfter | null)[] = [];

  public changed(pull: PullAfter | null): void {
    this.pulls.push(pull);
    this.completions.set(this.completions() + 1);
  }
}

class Panel {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public fixture: ComponentFixture<HostComponent> | null = null;

  public get host(): HostComponent {
    const host = this.fixture?.componentInstance;
    if (Object.isUndefined(host))
      throw new Error("The panel isn't open.");
    return host;
  }

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The panel isn't open.");
    return element;
  }

  public get completions(): readonly unknown[] {
    return this.payloadsOf(AzureDevOpsNames.completePullRequestMethod);
  }

  public payloadsOf(method: string): readonly unknown[] {
    return this.requests.payloads.filter((_, i) => this.requests.methods[i] === method);
  }

  public async openAsync(pullRequest: HostPullRequest = pullRequestOf()): Promise<this> {
    this.create(pullRequest);
    await this.settleAsync();
    return this;
  }

  public create(pullRequest: HostPullRequest = pullRequestOf()): void {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    this.fixture = TestBed.createComponent(HostComponent);
    this.fixture.componentInstance.pullRequest.set(pullRequest);
    this.fixture.autoDetectChanges();
  }

  public async settleAsync(): Promise<void> {
    await this.fixture?.whenStable();
    this.fixture?.detectChanges();
    await this.fixture?.whenStable();
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

  public texts(selector: string): string[] {
    return [...this.element.querySelectorAll(selector)].map(wordsOf);
  }

  public find(selector: string): HTMLElement {
    const found = this.element.querySelector(selector);
    if (!(found instanceof HTMLElement))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  }

  public get message(): HTMLTextAreaElement {
    const field = this.find(".message");
    if (!(field instanceof HTMLTextAreaElement))
      throw new Error("No message field is shown.");
    return field;
  }

  public isDisabled(selector: string): boolean {
    return this.find(selector).hasAttribute("disabled");
  }

  public async typeAsync(message: string): Promise<void> {
    this.message.value = message;
    this.message.dispatchEvent(new Event("input"));
    await this.settleAsync();
  }

  public async chooseAsync(label: string): Promise<void> {
    const radio = [...this.element.querySelectorAll<HTMLElement>("nol-radio")].find(t => wordsOf(t).startsWith(label))?.querySelector("input");
    if (Object.isNullOrUndefined(radio))
      throw new Error(`No merge type reads ${label}.`);
    radio.click();
    await this.settleAsync();
  }

  public async clickAsync(selector: string): Promise<void> {
    this.find(selector).click();
    await this.settleAsync();
  }

  public async completeAsync(): Promise<void> {
    await this.clickAsync(".complete-merge");
    await this.clickAsync(".confirm-action");
  }

  public async startAsync(): Promise<void> {
    await this.clickAsync(".complete-merge");
    this.find(".confirm-action").click();
    await this.untilAsync(() => this.isDisabled(".message"));
  }

  /** Clicks the button and gives the confirm it asks, none when it is held. */
  public async askAsync(selector: string): Promise<string[]> {
    await this.clickAsync(selector);
    return this.texts(".confirm");
  }
}

describe("AzureDevOpsCompleteComponent", () => {
  it("reads the merge types the branch allows and lists all four, the ones it forbids disabled and noted, choosing the first it allows", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ["squash", "rebaseMerge"]);
    await panel.openAsync();

    expect([panel.requests.methods, panel.requests.payloads]).toEqual([[AzureDevOpsNames.readMergeTypesMethod], [reference.toJson()]]);
    expect(panel.texts("nol-radio")).toEqual(["Merge, no fast-forward Not allowed by the branch policy", "Squash commit One commit on main, history kept in the PR",
      "Rebase and fast-forward Not allowed by the branch policy", "Semi-linear merge"]);
    expect([...panel.element.querySelectorAll("nol-radio input")].map(t => [t.getAttribute("aria-disabled"), t instanceof HTMLInputElement && t.checked]))
      .toEqual([["true", false], [null, true], ["true", false], [null, false]]);
    expect(panel.texts(".choice.on")).toEqual(["Squash commit One commit on main, history kept in the PR"]);
    expect(panel.message.value).toBe("Merged PR 752: Export notes as Markdown files\n\nRelated work items: #7521, #7499");
    expect(panel.texts("nol-checkbox")).toEqual(["Complete linked work items after merging", "Delete users/monalisa/7521-export-notes"]);
    expect([panel.element.querySelector(".blocking"), panel.isDisabled(".complete-merge"), panel.texts(".complete-title")]).toEqual([null, false, ["Complete"]]);
  });

  it("asks once, naming the merge, then completes with the commit and branches the page showed and the person's choices, and says it completed", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    panel.requests.answer(AzureDevOpsNames.completePullRequestMethod, null);
    await panel.openAsync();

    await panel.chooseAsync("Semi-linear merge");
    await panel.clickAsync(".complete-merge");
    const confirm: string[] = panel.texts(".confirm");
    const askedFirst: number = panel.completions.length;
    await panel.clickAsync(".confirm-action");
    await panel.untilAsync(() => panel.host.completions() === 1);

    expect(confirm).toEqual(["Complete !752 with Semi-linear merge into main, then deletes users/monalisa/7521-export-notes and completes 2 linked work items? "
      + "This merges it in Azure DevOps as you. Cancel Complete merge"]);
    expect([askedFirst, panel.completions]).toEqual([0, [{ reference: reference.toJson(), sourceCommit: COMMIT, targetBranch: "main", mergeType: "rebaseMerge",
      message: "Merged PR 752: Export notes as Markdown files\n\nRelated work items: #7521, #7499", completeWorkItems: true, deleteSourceBranch: true }]]);
  });

  it("sends no message for a fast-forward, the edited one otherwise, and neither option the person clears, naming only what is left", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    panel.requests.answer(AzureDevOpsNames.completePullRequestMethod, null, null);
    await panel.openAsync(pullRequestOf(752, [], [7521]));

    await panel.typeAsync("Merged PR 752: export-notes");
    await panel.clickAsync(".work-items input");
    await panel.clickAsync(".delete-branch input");
    await panel.clickAsync(".complete-merge");
    const plain: string[] = panel.texts(".confirm-text");
    await panel.clickAsync(".confirm-action");
    await panel.untilAsync(() => panel.host.completions() === 1);
    await panel.chooseAsync("Rebase and fast-forward");
    const field: Element | null = panel.element.querySelector(".message");
    await panel.clickAsync(".work-items input");
    await panel.clickAsync(".complete-merge");
    const one: string[] = panel.texts(".confirm-text");
    await panel.clickAsync(".confirm-action");
    await panel.untilAsync(() => panel.host.completions() === 2);

    expect([plain, field, one]).toEqual([["Complete !752 with Merge, no fast-forward into main? This merges it in Azure DevOps as you."], null,
      ["Complete !752 with Rebase and fast-forward into main, then completes 1 linked work item? This merges it in Azure DevOps as you."]]);
    expect(panel.completions).toEqual([
      { reference: reference.toJson(), sourceCommit: COMMIT, targetBranch: "main", mergeType: "noFastForward", message: "Merged PR 752: export-notes",
        completeWorkItems: false, deleteSourceBranch: false },
      { reference: reference.toJson(), sourceCommit: COMMIT, targetBranch: "main", mergeType: "rebase", message: null, completeWorkItems: true,
        deleteSourceBranch: false }]);
  });

  it("completes no work items when the page showed none linked, though the option is on, as the confirm names none", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    panel.requests.answer(AzureDevOpsNames.completePullRequestMethod, null);
    await panel.openAsync(pullRequestOf(752, [], []));

    const checked: boolean = panel.element.querySelector<HTMLInputElement>(".work-items input")?.checked ?? false;
    await panel.clickAsync(".complete-merge");
    const confirm: string[] = panel.texts(".confirm-text");
    await panel.clickAsync(".confirm-action");
    await panel.untilAsync(() => panel.host.completions() === 1);

    expect([checked, confirm]).toEqual([true,
      ["Complete !752 with Merge, no fast-forward into main, then deletes users/monalisa/7521-export-notes? This merges it in Azure DevOps as you."]]);
    expect(panel.completions).toEqual([{ reference: reference.toJson(), sourceCommit: COMMIT, targetBranch: "main", mergeType: "noFastForward",
      message: "Merged PR 752: Export notes as Markdown files", completeWorkItems: false, deleteSourceBranch: true }]);
  });

  it("sets auto-complete with the panel's choices after one confirm, while a required policy still blocks Complete merge", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    panel.requests.answer(AzureDevOpsNames.setAutoCompleteMethod, null);
    await panel.openAsync(pullRequestOf(752, [new HostPolicy("Comment requirements", PolicyState.Rejected, true, null)], [7521]));

    await panel.chooseAsync("Squash commit");
    await panel.clickAsync(".delete-branch input");
    const held: boolean = panel.isDisabled(".complete-merge");
    const confirm: string[] = await panel.askAsync(".set-auto-complete");
    const askedFirst: number = panel.payloadsOf(AzureDevOpsNames.setAutoCompleteMethod).length;
    await panel.clickAsync(".confirm-action");
    await panel.untilAsync(() => panel.host.completions() === 1);

    expect([held, confirm, askedFirst]).toEqual([true, ["Set !752 to complete by itself with Squash commit into main once its policies pass, then completes 1 linked "
      + "work item? Azure DevOps then merges it as you, without asking again. Cancel Set auto-complete"], 0]);
    expect([panel.payloadsOf(AzureDevOpsNames.setAutoCompleteMethod), panel.completions, panel.host.pulls]).toEqual([[{ reference: reference.toJson(),
      sourceCommit: COMMIT, targetBranch: "main", mergeType: "squash", message: "Merged PR 752: Export notes as Markdown files\n\nRelated work items: #7521",
      completeWorkItems: true, deleteSourceBranch: false }], [], [null]]);
  });

  it("asks nothing for auto-complete while the merge types are read", async () => {
    const panel = new Panel();
    const release = panel.requests.hold(AzureDevOpsNames.readMergeTypesMethod);
    panel.create();
    await panel.requests.askedAsync(1);

    panel.fixture?.detectChanges();
    const held: boolean = panel.isDisabled(".set-auto-complete");
    release(ALL);

    expect(held).toBe(true);
  });

  it("asks nothing for auto-complete while the message is blank, and names no work items it won't complete", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    await panel.openAsync(pullRequestOf(752, [], []));

    await panel.typeAsync(" ");
    const blank: string[] = await panel.askAsync(".set-auto-complete");
    const able: boolean = !panel.isDisabled(".set-auto-complete");
    await panel.typeAsync("Merged PR 752");
    const filled: string[] = await panel.askAsync(".set-auto-complete");

    expect([blank, able, filled]).toEqual([[], false, ["Set !752 to complete by itself with Merge, no fast-forward into main once its policies pass, then deletes "
      + "users/monalisa/7521-export-notes? Azure DevOps then merges it as you, without asking again. Cancel Set auto-complete"]]);
  });

  it("cancels auto-complete after one confirm, sending nothing when the person keeps it, and says the block then merges without them", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    panel.requests.answer(AzureDevOpsNames.cancelAutoCompleteMethod, null);
    await panel.openAsync(pullRequestOf(752, [new HostPolicy("Comment requirements", PolicyState.Rejected, true, null)], [], true));

    const blocking: string[] = panel.texts(".blocking");
    const kept: string[] = await panel.askAsync(".cancel-auto-complete");
    await panel.clickAsync(".cancel");
    const sentKept: number = panel.payloadsOf(AzureDevOpsNames.cancelAutoCompleteMethod).length;
    await panel.askAsync(".cancel-auto-complete");
    await panel.clickAsync(".confirm-action");
    await panel.untilAsync(() => panel.host.completions() === 1);

    expect([blocking, kept, sentKept]).toEqual([["error 1 policy blocks completion Comment requirements Auto-complete then merges it without you."],
      ["Stop !752 from completing by itself? It stays open until someone completes it. Keep auto-complete Cancel auto-complete"], 0]);
    expect([panel.payloadsOf(AzureDevOpsNames.cancelAutoCompleteMethod), panel.host.pulls]).toEqual([[reference.toJson()], [null]]);
  });

  it("abandons after one confirm that says Azure DevOps can reactivate it, sending the commit the page showed", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    panel.requests.answer(AzureDevOpsNames.abandonPullRequestMethod, null);
    await panel.openAsync();

    await panel.clickAsync(".abandon");
    const confirm: string[] = panel.texts(".confirm");
    await panel.clickAsync(".confirm-action");
    await panel.untilAsync(() => panel.host.completions() === 1);

    expect(confirm).toEqual(["Abandon !752? It closes without merging; Azure DevOps can reactivate it. Cancel Abandon"]);
    expect([panel.payloadsOf(AzureDevOpsNames.abandonPullRequestMethod), panel.completions]).toEqual([[{ reference: reference.toJson(), sourceCommit: COMMIT }], []]);
  });

  it("shows a write's failure in the panel and asks for nothing else while a write runs", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    const fail = panel.requests.holdFailure(AzureDevOpsNames.abandonPullRequestMethod);
    await panel.openAsync();

    await panel.clickAsync(".abandon");
    panel.find(".confirm-action").click();
    await panel.untilAsync(() => !Object.isNull(panel.element.querySelector(".abandon[disabled]")));
    const held: boolean[] = [panel.isDisabled(".complete-merge"), panel.isDisabled(".set-auto-complete")];
    fail(new RuntimeRequestException(FailureCode.Conflict, "The pull request isn't active any more; read it again."));
    await panel.untilAsync(() => !Object.isNull(panel.element.querySelector(".failure")));

    expect([held, panel.texts(".failure"), panel.isDisabled(".abandon"), panel.host.completions()]).toEqual([[true, true],
      ["error The pull request isn't active any more; read it again."], false, 0]);
  });

  it("offers to pull the target branch only in an open folder that clones this repository on that branch tracking it, and names it after Complete merge", async () => {
    const panel = new Panel();
    const folder = signal<string | null>("/work/site");
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), folder));
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    panel.requests.answer(AzureDevOpsNames.completePullRequestMethod, null, null);
    panel.requests.answer(GitNames.statusMethod, statusOf("main", "fabrikam/Web%20Site/_git/site"), statusOf("feature", "fabrikam/Web%20Site/_git/site"),
      statusOf("main", "fabrikam/Web%20Site/_git/site-api"), statusOf("main", "fabrikam/Web%20Site/_git/site", null),
      statusOf("main", "fabrikam/Web%20Site/_git/site", new StatusUpstream("origin/release", 0, 0, false)), statusOf("main", "Fabrikam/web%20site/_git/Site"));
    await panel.openAsync();

    const offered: string[] = panel.texts(".pull-after");
    const shown: boolean[] = [];
    for (const other of ["/work/feature", "/work/api", "/work/detached", "/work/release"]) {
      folder.set(other);
      await panel.settleAsync();
      shown.push(!Object.isNull(panel.element.querySelector(".pull-after")));
    }
    folder.set("/work/Site");
    await panel.settleAsync();
    await panel.completeAsync();
    await panel.untilAsync(() => panel.host.completions() === 1);
    await panel.clickAsync(".pull-after input");
    await panel.completeAsync();
    await panel.untilAsync(() => panel.host.completions() === 2);

    expect([offered, shown]).toEqual([["Pull main here after the merge"], [false, false, false, false]]);
    expect([panel.payloadsOf(GitNames.statusMethod).length, panel.host.pulls]).toEqual([6, [null, { folder: "/work/Site", branch: "main" }]]);
  });

  it("offers no pull when the folder's status can't be read, logging why, or comes for a folder the person left", async () => {
    const panel = new Panel();
    const folder = signal<string | null>("/work/site");
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), folder));
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    panel.requests.fail(GitNames.statusMethod, new WindowFailure("The runtime stopped."));
    const release = panel.requests.hold(GitNames.statusMethod);
    panel.requests.answer(GitNames.statusMethod, statusOf("feature", "fabrikam/Web%20Site/_git/site"));
    await panel.openAsync();

    folder.set("/work/held");
    await panel.requests.askedAsync(3);
    folder.set("/work/feature");
    await panel.requests.askedAsync(4);
    release(statusOf("main", "fabrikam/Web%20Site/_git/site"));
    await panel.settleAsync();

    expect([panel.element.querySelector(".pull-after"), panel.context.callsOf("log").map(t => t[0])]).toEqual([null,
      [`The Azure DevOps module's ${GitNames.statusMethod} request failed: WindowFailure: The runtime stopped.`]]);
  });

  it("holds Complete merge for a blank message or one over 4,000 characters, and sends nothing the person cancels", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    await panel.openAsync();

    await panel.typeAsync(" \n ");
    const blank: boolean = panel.isDisabled(".complete-merge");
    await panel.typeAsync("m".repeat(4001));
    const long: boolean = panel.isDisabled(".complete-merge");
    await panel.typeAsync("m".repeat(4000));
    await panel.clickAsync(".complete-merge");
    await panel.clickAsync(".cancel");
    const cancelled: boolean = Object.isNull(panel.element.querySelector(".confirm"));
    await panel.clickAsync(".complete-merge");
    await panel.chooseAsync("Squash commit");

    expect([blank, long, cancelled, panel.element.querySelector(".confirm"), panel.completions]).toEqual([true, true, true, null, []]);
  });

  it("names the required policies that block completion and holds Complete merge while one does", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    await panel.openAsync(pullRequestOf(752, [new HostPolicy("Minimum number of reviewers", PolicyState.Approved, true, null),
      new HostPolicy("Comment requirements", PolicyState.Rejected, true, null), new HostPolicy("Build", PolicyState.Running, true, null),
      new HostPolicy("Work item linking", PolicyState.Rejected, false, null)]));
    const two: string[] = panel.texts(".blocking");
    const held: boolean = panel.isDisabled(".complete-merge");

    panel.host.pullRequest.set(pullRequestOf(752, [new HostPolicy("Comment requirements", PolicyState.Running, true, null)]));
    await panel.settleAsync();

    expect([two, held, panel.texts(".blocking")]).toEqual([["error 2 policies block completion Comment requirements Build"], true,
      ["error 1 policy blocks completion Comment requirements"]]);
  });

  it("shows the runtime's sentence, or that Azure DevOps didn't answer, in the panel, never trying again by itself", async () => {
    const panel = new Panel();
    const stale = "The pull request has new commits since the page read it; read it again before completing it.";
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    panel.requests.fail(AzureDevOpsNames.completePullRequestMethod, new RuntimeRequestException(FailureCode.Conflict, stale));
    panel.requests.fail(AzureDevOpsNames.completePullRequestMethod, new WindowFailure("The runtime stopped."));
    await panel.openAsync();

    await panel.completeAsync();
    await panel.untilAsync(() => !Object.isNull(panel.element.querySelector(".failure")));
    const refused: string[] = panel.texts(".failure");
    await panel.completeAsync();
    await panel.untilAsync(() => panel.texts(".failure")[0] !== refused[0]);

    expect([refused, panel.texts(".failure"), panel.completions.length, panel.host.completions(), panel.isDisabled(".complete-merge")]).toEqual([[`error ${stale}`],
      ["error Azure DevOps didn't answer, so nothing changed. Try again."], 2, 0, false]);
    expect(panel.context.callsOf("log").map(t => t[0])).toEqual([
      `The Azure DevOps module's git-azure-devops.completePullRequest request failed: RuntimeRequestException: ${stale}`,
      "The Azure DevOps module's git-azure-devops.completePullRequest request failed: WindowFailure: The runtime stopped."]);
  });

  it("holds the panel while the completion runs", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    const release = panel.requests.hold(AzureDevOpsNames.completePullRequestMethod);
    await panel.openAsync();

    await panel.startAsync();
    const held = [panel.isDisabled(".complete-merge"), panel.isDisabled(".message"), panel.find(".work-items input").getAttribute("aria-disabled"),
      panel.find("nol-radio input").getAttribute("aria-disabled")];
    release(null);
    await panel.untilAsync(() => panel.host.completions() === 1);

    expect([held, panel.isDisabled(".complete-merge")]).toEqual([[true, true, "true", "true"], false]);
  });

  it.each([["answer", false], ["failure", true]] as const)("drops a completion's %s for a pull request it left, and reads the new one's merge types", async (_, isFailure) => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL, ["squash"]);
    let finish: () => void;
    if (isFailure) {
      const fail = panel.requests.holdFailure(AzureDevOpsNames.completePullRequestMethod);
      finish = () => fail(new WindowFailure("The runtime stopped."));
    }
    else {
      const release = panel.requests.hold(AzureDevOpsNames.completePullRequestMethod);
      finish = () => release(null);
    }
    await panel.openAsync();

    await panel.startAsync();
    panel.host.pullRequest.set(pullRequestOf(7));
    await panel.untilAsync(() => !Object.isNull(panel.element.querySelector(".choice.on")) && !panel.isDisabled(".message"));
    finish();
    await panel.settleAsync();

    expect([panel.host.completions(), panel.element.querySelector(".failure"), panel.isDisabled(".complete-merge"), panel.texts(".choice.on")]).toEqual([0, null, false,
      ["Squash commit One commit on main, history kept in the PR"]]);
    expect(panel.requests.payloads.filter((_, i) => panel.requests.methods[i] === AzureDevOpsNames.readMergeTypesMethod)).toEqual([reference.toJson(),
      new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 7).toJson()]);
  });

  it("says it is reading the merge types until they come, and holds Complete merge when the branch allows none", async () => {
    const panel = new Panel();
    const release = panel.requests.hold(AzureDevOpsNames.readMergeTypesMethod);
    panel.create();
    await panel.untilAsync(() => !Object.isNull(panel.element.querySelector(".reading")));
    const reading: string[] = panel.texts(".reading");
    const held: boolean = panel.isDisabled(".complete-merge");

    release([]);
    await panel.settleAsync();

    expect([reading, held, panel.isDisabled(".complete-merge"), panel.element.querySelector(".choice.on")]).toEqual([["Reading the merge types the branch allows."],
      true, true, null]);
  });

  it("says the merge types couldn't be read when signed out or when the window fails, logs the failure, and reads them again on Try again", async () => {
    const panel = new Panel();
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, null);
    panel.requests.fail(AzureDevOpsNames.readMergeTypesMethod, new WindowFailure("The runtime stopped."));
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    await panel.openAsync();
    const signedOut: string[] = panel.texts(".failure");

    await panel.clickAsync(".retry");
    await panel.untilAsync(() => panel.context.callsOf("log").length === 1);
    await panel.settleAsync();
    const failed: string[] = panel.texts(".failure");
    await panel.clickAsync(".retry");

    expect([signedOut, failed, panel.isDisabled(".complete-merge")]).toEqual([["error Azure DevOps didn't say which merge types the branch allows. Try again. Try again"],
      ["error Azure DevOps didn't say which merge types the branch allows. Try again. Try again"], false]);
    expect(panel.context.callsOf("log").map(t => t[0])).toEqual([
      "The Azure DevOps module's git-azure-devops.readMergeTypes request failed: WindowFailure: The runtime stopped."]);
  });

  it("drops merge types read for a pull request it left", async () => {
    const panel = new Panel();
    const release = panel.requests.hold(AzureDevOpsNames.readMergeTypesMethod);
    const fail = panel.requests.holdFailure(AzureDevOpsNames.readMergeTypesMethod);
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ["squash"]);
    panel.create();
    await panel.requests.askedAsync(1);

    panel.host.pullRequest.set(pullRequestOf(7));
    await panel.requests.askedAsync(2);
    panel.host.pullRequest.set(pullRequestOf(9));
    await panel.untilAsync(() => !Object.isNull(panel.element.querySelector(".choice.on")));
    release(ALL);
    fail(new WindowFailure("The runtime stopped."));
    await panel.settleAsync();

    expect([panel.texts(".choice.on"), panel.element.querySelector(".failure")]).toEqual([["Squash commit One commit on main, history kept in the PR"], null]);
  });

  it.each([AzureDevOpsNames.readMergeTypesMethod, AzureDevOpsNames.completePullRequestMethod])("rethrows a failure of %s that isn't the window's", async method => {
    const panel = new Panel();
    if (method === AzureDevOpsNames.completePullRequestMethod)
      panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    panel.requests.fail(method, new RangeError("Unexpected."));
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    await panel.openAsync();
    if (method === AzureDevOpsNames.completePullRequestMethod)
      await panel.completeAsync();

    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("rethrows a failure of the folder's status read that isn't the window's", async () => {
    const panel = new Panel();
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal<string | null>("/work/site")));
    panel.requests.answer(AzureDevOpsNames.readMergeTypesMethod, ALL);
    panel.requests.fail(GitNames.statusMethod, new RangeError("Unexpected."));
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    await panel.openAsync();

    expect(await rejection).toBeInstanceOf(RangeError);
  });
});
