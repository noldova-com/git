/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";

import type { WorkItemChoice } from "../models/work-item-choice.ts";
import { Resources } from "../../resources.ts";
import { SignedInDetailView } from "./signed-in-detail-view.ts";

export class WorkItemSelection {
  private static readonly windows: WeakMap<IWindowPartContext, SignedInDetailView<WorkItemChoice>> = new WeakMap();

  public static of(context: IWindowPartContext): SignedInDetailView<WorkItemChoice> {
    const known = WorkItemSelection.windows.get(context);
    if (!Object.isUndefined(known))
      return known;
    const view = new SignedInDetailView<WorkItemChoice>(context, Resources.workItemView, Resources.workItemViewInstance,
      t => Resources.formatWorkItemViewTitle(t.detail.item.id));
    WorkItemSelection.windows.set(context, view);
    return view;
  }
}
