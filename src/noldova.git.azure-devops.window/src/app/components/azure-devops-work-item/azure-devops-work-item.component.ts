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
import { type IWindowPartContext, WindowException, WindowPartTokens } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { type HostWorkItemDetail, HostWorkItemList, SignInState, WorkItemScope, WorkItemsQuery } from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitNames, GitStatus } from "@noldova/git.protocol";
import { type GitDetailView, GitFolder } from "@noldova/git.window";
import { ButtonComponent, ButtonVariant, MenuComponent, MenuItemComponent, MenuTriggerDirective, SpinnerComponent } from "@noldova/ui.components.angular";

import { AzureDevOpsWorkItemTableComponent } from "../azure-devops-work-item-table/azure-devops-work-item-table.component.ts";
import { WorkItemFacet } from "../../enums/work-item-facet.ts";
import { WorkItemChoice } from "../../models/work-item-choice.ts";
import { WorkItemFilter } from "../../models/work-item-filter.ts";
import { WorkItemRow } from "../../models/work-item-row.ts";
import { WorkItemsPlace } from "../../models/work-items-place.ts";
import { Resources } from "../../../resources.ts";
import { AccountSettings } from "../../services/account-settings.ts";
import { SignInEvents } from "../../services/sign-in-events.ts";
import { WorkItemSelection } from "../../services/work-item-selection.ts";
import { WorkItemsPages } from "../../services/work-items-pages.ts";

@Component({
  selector: "nol-git-azure-devops-work-item",
  templateUrl: "./azure-devops-work-item.component.html",
  styleUrl: "./azure-devops-work-item.component.css",
  imports: [AzureDevOpsWorkItemTableComponent, ButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, SpinnerComponent]
})
export class AzureDevOpsWorkItemComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly attempt: WritableSignal<number> = signal<number>(0);
  private readonly selection: GitDetailView<WorkItemChoice> = WorkItemSelection.of(this.context);

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly folder: Signal<string | null> = GitFolder.folder;
  protected readonly place: WritableSignal<WorkItemsPlace | null> = signal<WorkItemsPlace | null>(null);
  protected readonly details: WritableSignal<readonly HostWorkItemDetail[]> = signal<readonly HostWorkItemDetail[]>([]);
  protected readonly filter: WritableSignal<WorkItemFilter> = signal<WorkItemFilter>(WorkItemFilter.none);
  protected readonly rows: Signal<readonly WorkItemRow[]> = computed(() => WorkItemRow.rowsOf(this.filter().apply(this.details())));
  protected readonly chosen: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly selected: Signal<HostWorkItemDetail | null> = computed(() => {
    const rows: readonly WorkItemRow[] = this.rows();
    const chosen: number | null = this.chosen();
    return rows.find(t => t.detail.item.id === chosen)?.detail ?? rows[0]?.detail ?? null;
  });
  protected readonly choice: Signal<WorkItemChoice | null> = computed(() => {
    const place: WorkItemsPlace | null = this.place();
    const detail: HostWorkItemDetail | null = this.selected();
    return Object.isNull(place) || Object.isNull(detail) ? null : this.choiceOf(place, detail);
  });
  protected readonly isMissing: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly isReading: WritableSignal<boolean> = signal<boolean>(true);
  protected readonly isTruncated: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly isSignedOut: WritableSignal<boolean> = signal<boolean>(false);

  public readonly instance: InputSignal<string> = input.required<string>();

  public constructor() {
    const active: Signal<boolean> = inject(WindowPartTokens.activeDocument);
    this.selection.follow(this.choice, active, inject(Injector));
    inject(DestroyRef).onDestroy(WorkItemsPages.follow(this.place, active));
    inject(DestroyRef).onDestroy(SignInEvents.follow(this.context, signIn => {
      if (signIn.state === SignInState.Waiting)
        return;
      this.isSignedOut.set(signIn.state === SignInState.SignedOut);
      this.retry();
    }));
    effect(onCleanup => {
      this.attempt();
      const instance: string = this.instance();
      const folder: string | null = this.folder();
      const isSignedOut: boolean = this.isSignedOut();
      let isCurrent = true;
      onCleanup(() => {
        isCurrent = false;
      });
      untracked(() => {
        this.details.set([]);
        this.isTruncated.set(false);
        this.filter.set(WorkItemFilter.none);
        this.failure.set(null);
        this.isMissing.set(false);
        this.isReading.set(!isSignedOut);
        if (!isSignedOut)
          void this.readAsync(instance, folder, () => isCurrent);
      });
    });
  }

  protected retry(): void {
    this.attempt.update(t => t + 1);
  }

  protected signIn(): void {
    AccountSettings.open(this.context);
  }

  protected choose(place: WorkItemsPlace, detail: HostWorkItemDetail): void {
    this.chosen.set(detail.item.id);
    this.selection.showInFront(this.choiceOf(place, detail));
  }

  protected choicesOf(facet: WorkItemFacet): readonly string[] {
    return WorkItemFilter.choicesOf(this.details(), facet);
  }

  protected chooseValue(facet: WorkItemFacet, value: string | null): void {
    this.filter.update(t => t.with(facet, value));
  }

  protected chipOf(facet: WorkItemFacet): string {
    return Resources.formatFacetFilter(facet, this.filter().of(facet));
  }

  protected newWorkItem(place: WorkItemsPlace): void {
    void this.openAsync(Resources.formatNewWorkItemAddress(place.organization, place.project));
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

  private async readAsync(instance: string, folder: string | null, isCurrent: () => boolean): Promise<void> {
    const done = this.tasks.add();
    let method: string = GitNames.statusMethod;
    try {
      let place: WorkItemsPlace | null = WorkItemsPlace.ofInstance(instance);
      if (Object.isNull(place) && instance === "" && !Object.isNull(folder))
        place = WorkItemsPlace.ofRemote(GitStatus.fromJson(await this.context.requestAsync(method, new GitFolderParams(folder).toJson())).remote);
      if (!isCurrent())
        return;
      this.place.set(place);
      this.chosen.set(place?.id ?? null);
      if (Object.isNull(place)) {
        this.isMissing.set(true);
        return;
      }
      method = AzureDevOpsNames.readWorkItemsMethod;
      const query = new WorkItemsQuery(AzureDevOpsNames.moduleId, place.organization, place.project, WorkItemScope.Mine, []);
      const list: HostWorkItemList = HostWorkItemList.fromJson(await this.context.requestAsync(method, query.toJson()));
      if (isCurrent()) {
        this.details.set(list.items);
        this.isTruncated.set(list.isTruncated);
      }
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(method, String(error)));
      if (isCurrent())
        this.failure.set(Resources.workItemsUnanswered);
    }
    finally {
      if (isCurrent())
        this.isReading.set(false);
      done();
    }
  }

  private choiceOf(place: WorkItemsPlace, detail: HostWorkItemDetail): WorkItemChoice {
    return new WorkItemChoice(place, detail, this.details());
  }
}
