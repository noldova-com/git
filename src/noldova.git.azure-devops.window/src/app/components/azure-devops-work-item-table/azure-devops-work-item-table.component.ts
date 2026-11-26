/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, input, type InputSignal, output, type OutputEmitterRef, type Signal, signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import type { HostReference, HostWorkItem, HostWorkItemDetail } from "@noldova/git.hosting.protocol";

import { PullRequestDocument } from "../../models/pull-request-document.ts";
import { WorkItemTableRow } from "../../models/work-item-table-row.ts";
import type { WorkItemRow } from "../../models/work-item-row.ts";
import { Resources } from "../../../resources.ts";

@Component({
  selector: "nol-git-azure-devops-work-item-table",
  templateUrl: "./azure-devops-work-item-table.component.html",
  styleUrl: "./azure-devops-work-item-table.component.css"
})
export class AzureDevOpsWorkItemTableComponent {
  protected readonly resources: typeof Resources = Resources;

  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);

  public readonly rows: InputSignal<readonly WorkItemRow[]> = input.required<readonly WorkItemRow[]>();

  public readonly selected: InputSignal<HostWorkItemDetail | null> = input<HostWorkItemDetail | null>(null);

  public readonly label: InputSignal<string> = input.required<string>();

  public readonly empty: InputSignal<string> = input.required<string>();

  public readonly chosen: OutputEmitterRef<HostWorkItemDetail> = output<HostWorkItemDetail>();

  private readonly collapsed: WritableSignal<ReadonlySet<number>> = signal<ReadonlySet<number>>(new Set());

  protected readonly shown: Signal<readonly WorkItemTableRow[]> = computed(() => WorkItemTableRow.shownOf(this.rows(), this.collapsed()));

  protected toggle(event: Event, row: WorkItemTableRow): void {
    event.stopPropagation();
    const id: number = row.row.detail.item.id;
    this.collapsed.update(t => t.has(id) ? new Set([...t].filter(u => u !== id)) : new Set([...t, id]));
  }

  protected openPullRequest(event: Event, pullRequest: HostReference): void {
    event.stopPropagation();
    this.context.openDocument(Resources.pullRequestDocument, PullRequestDocument.instanceOf(pullRequest), Resources.formatPullRequestReference(pullRequest.number));
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

  protected linkOf(detail: HostWorkItemDetail): string {
    const pullRequest: HostReference | undefined = detail.pullRequests[0];
    if (!Object.isUndefined(pullRequest))
      return Resources.formatPullRequestReference(pullRequest.number);
    if (detail.commits > 0)
      return Resources.formatCommits(detail.commits);
    return detail.children.length > 0 ? Resources.formatChildren(detail.children.length) : Resources.noLinks;
  }
}
