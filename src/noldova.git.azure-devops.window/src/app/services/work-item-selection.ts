/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";
import { GitDetailView } from "@noldova/git.window";

import type { WorkItemChoice } from "../models/work-item-choice.ts";
import { Resources } from "../../resources.ts";

/** The Work item view of each window, which shows the work item chosen in the document in front that chooses work items. */
export class WorkItemSelection {
  private static readonly windows: WeakMap<IWindowPartContext, GitDetailView<WorkItemChoice>> = new WeakMap();

  public static of(context: IWindowPartContext): GitDetailView<WorkItemChoice> {
    const known = WorkItemSelection.windows.get(context);
    if (!Object.isUndefined(known))
      return known;
    const view = new GitDetailView<WorkItemChoice>(context, Resources.workItemView, Resources.workItemViewInstance,
      t => Resources.formatWorkItemViewTitle(t.detail.item.id));
    WorkItemSelection.windows.set(context, view);
    return view;
  }
}
