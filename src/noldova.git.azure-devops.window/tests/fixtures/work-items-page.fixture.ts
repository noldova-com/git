/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, input, type InputSignal, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostChanges, HostItem, HostPerson, HostPolicy, HostPullRequest, HostReference, HostWorkItem, HostWorkItemDetail, HostWorkItemList, HostWorkItemType,
  type JsonObject, PolicyState, ReferenceKind, ReferenceState, WorkItemCategory, WorkItemScope, WorkItemsQuery } from "@noldova/git.hosting.protocol";
import { GitCommit, GitGraph, GitGraphCommit, GitMessageReference, GitMessageReferences, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";

import { AzureDevOpsWorkItemComponent } from "../../src/app/components/azure-devops-work-item/azure-devops-work-item.component.ts";
import { AzureDevOpsWorkItemDetailComponent } from "../../src/app/components/azure-devops-work-item-detail/azure-devops-work-item-detail.component.ts";
import { RequestAnswers } from "./request-answers.fixture.ts";
import { Wait } from "./wait.fixture.ts";

export const HOST: string = "git-azure-devops";
export const PROJECT: string = "Sample Project";
export const INSTANCE: string = "fabrikam/Sample%20Project";
const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const epic: HostWorkItemType = new HostWorkItemType("Epic", "FF7B00", "icon_crown");
const feature: HostWorkItemType = new HostWorkItemType("Feature", "773B93", "icon_trophy");
export const story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");
export const task: HostWorkItemType = new HostWorkItemType("Task", "F2CB1D", "icon_clipboard");
const issue: HostWorkItemType = new HostWorkItemType("Issue", "339933", "icon_unknown");
export const bug: HostWorkItemType = new HostWorkItemType("Bug", "CC293D", "icon_insect");
export const pr482: HostReference = new HostReference(HOST, "fabrikam", REPOSITORY, 482);
const pr479: HostReference = new HostReference(HOST, "fabrikam", REPOSITORY, 479);

export function urlOf(id: number): string {
  return `https://dev.azure.com/fabrikam/Sample%20Project/_workitems/edit/${id}`;
}

class Planned {
  public readonly points: number | null;
  public readonly remaining: number | null;
  public readonly completed: number | null;

  public constructor(points: number | null, remaining: number | null, completed: number | null) {
    this.points = points;
    this.remaining = remaining;
    this.completed = completed;
  }
}

class Linked {
  public readonly children: readonly number[];
  public readonly pullRequests: readonly HostReference[];
  public readonly commits: number;
  public readonly branches: readonly string[];

  public constructor(children: readonly number[], pullRequests: readonly HostReference[], commits: number, branches: readonly string[]) {
    this.children = children;
    this.pullRequests = pullRequests;
    this.commits = commits;
    this.branches = branches;
  }
}

const unlinked: Linked = new Linked([], [], 0, []);
const unplanned: Planned = new Planned(null, null, null);

export function itemOf(id: number, type: HostWorkItemType, title: string, state: string, category: WorkItemCategory, parent: number | null): HostWorkItem {
  return new HostWorkItem(HOST, "fabrikam", PROJECT, id, type, title, state, category, urlOf(id), new HostPerson("ana@fabrikam.com", null, null),
    "Sample Project\\Sprint 47", "Sample Project\\Notes app", parent);
}

export function detailOf(item: HostWorkItem, links: Linked = unlinked, plan: Planned = unplanned, acceptance: string | null = null): HostWorkItemDetail {
  return new HostWorkItemDetail(item, plan.points, plan.remaining, plan.completed, null, acceptance, links.children, links.pullRequests, links.commits,
    links.branches);
}

export function listOf(details: readonly HostWorkItemDetail[]): JsonObject {
  return new HostWorkItemList(details, false).toJson();
}

export const epicItem: HostWorkItem = itemOf(4702, epic, "Note sharing and sync", "Active", WorkItemCategory.InProgress, null);
const featureItem: HostWorkItem = itemOf(4790, feature, "Markdown export", "Active", WorkItemCategory.InProgress, 4702);
const storyItem: HostWorkItem = itemOf(4821, story, "Export notes as Markdown files", "Active", WorkItemCategory.InProgress, 4790);
export const mine: readonly HostWorkItemDetail[] = [
  detailOf(epicItem),
  detailOf(featureItem, new Linked([4821], [], 0, [])),
  detailOf(storyItem, new Linked([4830, 4831, 4832], [pr482], 5, ["users/ana/4821-export-notes-markdown"]), new Planned(5, null, null),
    "Readers see a due date 48 h and 2 h before it is due."),
  detailOf(itemOf(4831, task, "Read local times from the app settings", "Active", WorkItemCategory.InProgress, 4821), new Linked([], [], 1, [])),
  detailOf(itemOf(4832, task, "Tag filter ignores case in note titles", "New", WorkItemCategory.Proposed, 4821)),
  detailOf(new HostWorkItem(HOST, "fabrikam", PROJECT, 4811, issue, "Note due dates show UTC times", "Resolved", WorkItemCategory.Resolved, urlOf(4811),
    null, null, null, 4999), new Linked([], [pr479], 0, []))
];
export const tasks: readonly HostWorkItemDetail[] = [
  detailOf(itemOf(4830, task, "Note card with tag chips", "Closed", WorkItemCategory.Completed, 4821), unlinked, new Planned(null, 0, 6)),
  detailOf(itemOf(4831, task, "Local times from settings", "Active", WorkItemCategory.InProgress, 4821), unlinked, new Planned(null, 2, 2)),
  detailOf(itemOf(4832, task, "Tag filter ignores letter case", "New", WorkItemCategory.Proposed, 4821), unlinked, new Planned(null, 4, null))
];
export const pullRequest: HostPullRequest = new HostPullRequest(new HostItem(pr482, ReferenceKind.PullRequest, ReferenceState.Open, "Export notes",
  "https://dev.azure.com/fabrikam/Sample%20Project/_git/portal-web/pullrequest/482", null, Date.UTC(2026, 10, 20), null, 0, 
  new HostChanges(null, null, null, "users/ana/4821-export-notes-markdown", "main", "0123456789abcdef0123456789abcdef01234567")), [], [
  new HostPolicy("Minimum number of reviewers", PolicyState.Approved, true, null),
  new HostPolicy("Build", PolicyState.Approved, true, null),
  new HostPolicy("Work item linking", PolicyState.Approved, true, null),
  new HostPolicy("Comment requirements", PolicyState.Rejected, true, null),
  new HostPolicy("Optional check", PolicyState.Rejected, false, null)
], [], false, "", null, []);

export const azureStatus: GitStatus = new GitStatus("main", "a".repeat(40), null, [], false, "f1", null,
  new GitRemote("origin", "dev.azure.com", "fabrikam/Sample%20Project/_git/portal-web", RemoteTransport.Https));
export const githubStatus: GitStatus = new GitStatus("main", null, null, [], false, "f1", null, new GitRemote("origin", "github.com", "fabrikam/site", RemoteTransport.Https));

function commitOf(id: string, subject: string, minutesAgo: number): GitGraphCommit {
  const authoredAt: string = new Date(Date.now() - minutesAgo * 60_000).toISOString().replace(/\.\d{3}Z$/u, "Z");
  return new GitGraphCommit(new GitCommit(id.repeat(40), [], "Mona Lisa", authoredAt, subject), "ana@fabrikam.com", []);
}

export const history: GitGraph = new GitGraph([commitOf("a", "Fold the tag case in the note list filter #4832", 12), commitOf("b", "Read local times AB#4831 and AB#4702", 125),
  commitOf("c", "Tidy x#4702 and ab#4702", 4320)], true);
export const messages: GitMessageReferences = new GitMessageReferences([new GitMessageReference("c".repeat(40), [4821])], true);
export const noMessages: JsonObject = new GitMessageReferences([], false).toJson();

export function mineQuery(): WorkItemsQuery {
  return new WorkItemsQuery(HOST, "fabrikam", PROJECT, WorkItemScope.Mine, []);
}

export function childrenQuery(ids: readonly number[]): WorkItemsQuery {
  return new WorkItemsQuery(HOST, "fabrikam", PROJECT, WorkItemScope.Ids, ids);
}

function wordsOf(node: Node): string {
  const words: string[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text !== null; text = walker.nextNode())
    words.push((text.textContent ?? "").trim());
  return words.filter(t => t.length > 0).join(" ").replace(/\s+/g, " ");
}

@Component({
  selector: "nol-git-azure-devops-work-items-window",
  imports: [AzureDevOpsWorkItemComponent, AzureDevOpsWorkItemDetailComponent],
  template: "<nol-git-azure-devops-work-item [instance]=\"instance()\" /><nol-git-azure-devops-work-item-detail instance=\"selected\" />"
})
class WorkItemsWindowComponent {
  public readonly instance: InputSignal<string> = input.required<string>();
}

export class Page {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context).ignore(AzureDevOpsNames.readPersonAvatarMethod);
  public readonly active: WritableSignal<boolean> = signal(true);
  public fixture: ComponentFixture<WorkItemsWindowComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The page isn't open.");
    return element;
  }

  public get text(): string {
    return wordsOf(this.find("nol-git-azure-devops-work-item"));
  }

  public get links(): readonly unknown[] {
    return this.context.callsOf("openLinkAsync").map(t => t[0]);
  }

  public get logs(): readonly unknown[] {
    return this.context.callsOf("log").map(t => t[0]);
  }

  public texts(selector: string): readonly string[] {
    return [...this.element.querySelectorAll(selector)].map(t => wordsOf(t));
  }

  public find(selector: string): HTMLElement {
    const found = this.element.querySelector(selector);
    if (!(found instanceof HTMLElement))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  }

  public answerMine(details: readonly HostWorkItemDetail[] = mine, isTruncated: boolean = false): this {
    this.requests.answer(AzureDevOpsNames.readWorkItemsMethod, new HostWorkItemList(details, isTruncated).toJson());
    return this;
  }

  public async openAsync(instance: string = INSTANCE): Promise<this> {
    this.open(instance);
    await this.settleAsync();
    return this;
  }

  public open(instance: string = INSTANCE): this {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context },
      { provide: WindowPartTokens.activeDocument, useValue: this.active }] });
    this.fixture = TestBed.createComponent(WorkItemsWindowComponent);
    this.fixture.componentRef.setInput("instance", instance);
    this.fixture.autoDetectChanges();
    return this;
  }

  public async settleAsync(): Promise<void> {
    await this.fixture?.whenStable();
    this.fixture?.detectChanges();
    await this.fixture?.whenStable();
  }

  public async clickAsync(selector: string): Promise<void> {
    this.find(selector).click();
    await this.settleAsync();
  }

  /** Opens the menu the selector's chip opens, picks the item labelled the choice, and answers the items' labels, the checked one marked `* `. */
  public async chooseAsync(selector: string, choice: string): Promise<readonly string[]> {
    const items = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("button[nol-menu-item]")];
    const labelOf = (item: HTMLElement): string => item.querySelector(".nol-menu-item-label")?.textContent?.trim() ?? "";
    await Wait.until(() => {
      if (items().length > 0)
        throw new Error("A menu is still open.");
    });
    this.find(selector).click();
    const listed: readonly string[] = await Wait.until(() => {
      const found: readonly string[] = items().map(t => `${t.getAttribute("aria-checked") === "true" ? "* " : ""}${labelOf(t)}`);
      if (found.length === 0)
        throw new Error("The menu hasn't opened.");
      return found;
    });
    const chosen: HTMLElement | undefined = items().find(t => labelOf(t) === choice);
    if (chosen === undefined)
      throw new Error(`The menu has no ${choice}.`);
    chosen.click();
    await this.settleAsync();
    return listed;
  }

  public async chooseRowAsync(id: number): Promise<void> {
    const row: HTMLElement | undefined = [...this.element.querySelectorAll<HTMLElement>(".item")].find(t => t.querySelector(".id")?.textContent?.trim() === String(id));
    row?.click();
    await this.settleAsync();
  }

  public get ids(): readonly string[] {
    return this.texts(".item .id");
  }
}
