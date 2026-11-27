/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, inject, Injector, input, type InputSignal, PendingTasks, type Signal, signal, untracked,
  type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostPullRequest, type HostReference, type HostWorkItem, type HostWorkItemDetail, HostWorkItemList, PolicyState, SignInState, WorkItemScope, WorkItemsQuery }
  from "@noldova/git.hosting.protocol";
import type { GitCommit } from "@noldova/git.protocol";
import { GitFolder, GitHistorySelection } from "@noldova/git.window";
import { AvatarSize, ButtonComponent, IconButtonComponent } from "@noldova/ui.components.angular";

import { BranchRequest } from "../../models/branch-request.ts";
import { LinkedHistory } from "../../models/linked-history.ts";
import type { SubjectPart } from "../../models/subject-part.ts";
import type { WorkItemChoice } from "../../models/work-item-choice.ts";
import type { WorkItemsPlace } from "../../models/work-items-place.ts";
import { Resources } from "../../../resources.ts";
import { AzureDevOpsChipItems } from "../../services/azure-devops-chip-items.ts";
import { AzureDevOpsLinkedCommits } from "../../services/azure-devops-linked-commits.ts";
import { BranchDialog } from "../../services/branch-dialog.ts";
import { SignInEvents } from "../../services/sign-in-events.ts";
import { WorkItemSelection } from "../../services/work-item-selection.ts";
import { AzureDevOpsPersonAvatarComponent } from "../azure-devops-person-avatar/azure-devops-person-avatar.component.ts";

@Component({
  selector: "nol-git-azure-devops-work-item-detail",
  templateUrl: "./azure-devops-work-item-detail.component.html",
  styleUrl: "./azure-devops-work-item-detail.component.css",
  imports: [AzureDevOpsPersonAvatarComponent, ButtonComponent, IconButtonComponent]
})
export class AzureDevOpsWorkItemDetailComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly injector: Injector = inject(Injector);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly history: AzureDevOpsLinkedCommits = new AzureDevOpsLinkedCommits(this.context);
  private chipItems: AzureDevOpsChipItems = new AzureDevOpsChipItems(this.context);
  private readonly dates: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, Resources.linkedCommitDateFormat);

  protected readonly resources: typeof Resources = Resources;
  protected readonly small: AvatarSize = AvatarSize.Small;
  protected readonly folder: Signal<string | null> = GitFolder.folder;
  protected readonly choice: Signal<WorkItemChoice | null> = WorkItemSelection.of(this.context).choice;
  protected readonly selected: Signal<HostWorkItemDetail | null> = computed(() => this.choice()?.detail ?? null);
  protected readonly children: WritableSignal<readonly HostWorkItemDetail[]> = signal<readonly HostWorkItemDetail[]>([]);
  protected readonly pullRequests: WritableSignal<ReadonlyMap<number, HostPullRequest>> = signal<ReadonlyMap<number, HostPullRequest>>(new Map());
  protected readonly hoursLeft: Signal<string | null> = computed(() => {
    const children: readonly HostWorkItemDetail[] = this.children();
    const left: number = children.reduce((total, t) => total + (t.remaining ?? 0), 0);
    const total: number = left + children.reduce((done, t) => done + (t.completed ?? 0), 0);
    return total === 0 ? null : Resources.formatHoursLeft(left, total);
  });
  protected readonly linked: WritableSignal<LinkedHistory> = signal<LinkedHistory>(LinkedHistory.none);

  public readonly instance: InputSignal<string> = input.required<string>();

  public constructor() {
    inject(DestroyRef).onDestroy(SignInEvents.follow(this.context, signIn => {
      if (signIn.state !== SignInState.Waiting)
        this.chipItems = new AzureDevOpsChipItems(this.context);
    }));
    effect(() => {
      const id: number | undefined = this.selected()?.item.id;
      const instance: string = this.instance();
      untracked(() => this.context.updateView(Resources.workItemView, instance,
        { title: Object.isUndefined(id) ? Resources.workItemViewLabel : Resources.formatWorkItemViewTitle(id) }));
    });
    effect(onCleanup => {
      const detail: HostWorkItemDetail | null = this.selected();
      const place: WorkItemsPlace | null = untracked(() => this.choice()?.place ?? null);
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        this.children.set([]);
        this.pullRequests.set(new Map());
        if (!Object.isNull(detail) && !Object.isNull(place))
          void this.readLinksAsync(place, detail, () => isCurrent);
      });
    });
    effect(onCleanup => {
      const folder: string | null = this.folder();
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        this.linked.set(LinkedHistory.none);
        if (!Object.isNull(folder))
          void this.readHistoryAsync(folder, () => isCurrent);
      });
    });
  }

  protected linkedOf(item: HostWorkItem): readonly GitCommit[] {
    return this.linked().commitsOf(item.organization, item.id);
  }

  protected shortOf(commit: GitCommit): string {
    return commit.id.slice(0, Resources.shortCommitLength);
  }

  protected ageOf(commit: GitCommit): string {
    const authored: number = Date.parse(commit.authoredAt);
    return Resources.formatCommitAge(Date.now() - authored) ?? this.dates.format(authored);
  }

  protected partsOf(commit: GitCommit): readonly SubjectPart[] {
    return this.linked().partsOf(commit.subject);
  }

  protected chipItemOf(choice: WorkItemChoice, id: number): HostWorkItem | null {
    const shown: HostWorkItem = choice.detail.item;
    const read: HostWorkItemDetail | undefined = [...choice.known, ...this.children()].find(t => t.item.id === id && t.item.organization === shown.organization);
    return Object.isUndefined(read) ? this.chipItems.itemOf(shown.organization, shown.project, id)() : read.item;
  }

  protected showCommit(folder: string, commit: GitCommit): void {
    void this.showCommitAsync(folder, commit);
  }

  protected iconOf(item: HostWorkItem): string {
    return Resources.workItemIconOf(item.type.icon);
  }

  protected imageOf(item: HostWorkItem): string | null {
    return Resources.workItemImageOf(item.type);
  }

  protected colorOf(item: HostWorkItem): string {
    return Resources.formatHexColor(item.type.color);
  }

  protected parentOf(detail: HostWorkItemDetail): HostWorkItem | null {
    return this.choice()?.known.find(t => t.item.id === detail.item.parent)?.item ?? null;
  }

  protected policiesOf(reference: HostReference): string | null {
    const required = this.pullRequests().get(reference.number)?.policies.filter(t => t.isBlocking) ?? [];
    return required.length === 0 ? null : Resources.formatPolicies(required.filter(t => t.state === PolicyState.Approved).length, required.length);
  }

  protected isBlocked(reference: HostReference): boolean {
    return this.pullRequests().get(reference.number)?.policies.some(t => t.isBlocking && t.state !== PolicyState.Approved) ?? false;
  }

  protected createBranch(item: HostWorkItem, folder: string): void {
    BranchDialog.open(this.context, new BranchRequest(folder, item.organization, item.id, item.title), this.injector);
  }

  protected async openAsync(url: string): Promise<void> {
    const done = this.tasks.add();
    try {
      await this.context.openLinkAsync(url);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatLinkFailed(url, String(error)));
    }
    finally {
      done();
    }
  }

  private async readHistoryAsync(folder: string, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      const history: LinkedHistory = await this.history.readAsync(folder);
      if (isCurrent())
        this.linked.set(history);
    }
    finally {
      done();
    }
  }

  private async showCommitAsync(folder: string, commit: GitCommit): Promise<void> {
    try {
      await GitHistorySelection.selectAsync(this.context, folder, commit.id);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(Resources.openHistoryCommand, String(error)));
    }
  }

  private async readLinksAsync(place: WorkItemsPlace, detail: HostWorkItemDetail, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    try {
      await Promise.all([this.readChildrenAsync(place, detail, isCurrent), ...detail.pullRequests.map(t => this.readPullRequestAsync(t, isCurrent))]);
    }
    finally {
      done();
    }
  }

  private async readChildrenAsync(place: WorkItemsPlace, detail: HostWorkItemDetail, isCurrent: () => boolean): Promise<void> {
    if (detail.children.length === 0)
      return;
    const query = new WorkItemsQuery(AzureDevOpsNames.moduleId, place.organization, place.project, WorkItemScope.Ids, detail.children);
    const answer: JsonValue | null = await this.askAsync(AzureDevOpsNames.readWorkItemsMethod, query.toJson());
    if (!Object.isNull(answer) && isCurrent())
      this.children.set(HostWorkItemList.fromJson(answer).items);
  }

  private async readPullRequestAsync(reference: HostReference, isCurrent: () => boolean): Promise<void> {
    const answer: JsonValue | null = await this.askAsync(AzureDevOpsNames.readPullRequestMethod, reference.toJson());
    if (!Object.isNull(answer) && isCurrent())
      this.pullRequests.update(t => {
        const read: Map<number, HostPullRequest> = new Map(t);
        read.set(reference.number, HostPullRequest.fromJson(answer));
        return read;
      });
  }

  private async askAsync(method: string, payload: JsonValue): Promise<JsonValue | null> {
    try {
      return await this.context.requestAsync(method, payload);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(method, String(error)));
      return null;
    }
  }
}
