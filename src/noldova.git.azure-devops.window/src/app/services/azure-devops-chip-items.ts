/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowException } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { type HostWorkItem, HostWorkItemList, WorkItemScope, WorkItemsQuery } from "@noldova/git.hosting.protocol";

import { Resources } from "../../resources.ts";
import { WaitingItems } from "../models/waiting-items.ts";

export class AzureDevOpsChipItems {
  private readonly context: IWindowPartContext;
  private readonly items: Map<string, WritableSignal<HostWorkItem | null>> = new Map();
  private readonly waiting: Map<string, WaitingItems> = new Map();

  public constructor(context: IWindowPartContext) {
    this.context = context;
  }

  public itemOf(organization: string, project: string, id: number): Signal<HostWorkItem | null> {
    const key: string = Resources.formatWorkItemKey(organization, id);
    const known: WritableSignal<HostWorkItem | null> | undefined = this.items.get(key);
    if (!Object.isUndefined(known))
      return known;
    const item: WritableSignal<HostWorkItem | null> = signal<HostWorkItem | null>(null);
    this.items.set(key, item);
    if (this.waiting.size === 0)
      queueMicrotask(() => void this.readWaitingAsync());
    const place: string = JSON.stringify([organization, project]);
    const group: WaitingItems = this.waiting.get(place) ?? new WaitingItems(organization, project);
    group.ids.push(id);
    this.waiting.set(place, group);
    return item;
  }

  private async readWaitingAsync(): Promise<void> {
    const groups = [...this.waiting.values()];
    this.waiting.clear();
    for (const { organization, project, ids } of groups)
      for (let start = 0; start < ids.length; start += Resources.chipItemsBatchSize)
        await this.readAsync(new WorkItemsQuery(AzureDevOpsNames.moduleId, organization, project, WorkItemScope.Ids,
          ids.slice(start, start + Resources.chipItemsBatchSize)));
  }

  private async readAsync(query: WorkItemsQuery): Promise<void> {
    try {
      const list: HostWorkItemList = HostWorkItemList.fromJson(await this.context.requestAsync(AzureDevOpsNames.readWorkItemsMethod, query.toJson()));
      for (const { item } of list.items)
        this.items.get(Resources.formatWorkItemKey(item.organization, item.id))?.set(item);
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(AzureDevOpsNames.readWorkItemsMethod, String(error)));
    }
  }
}
