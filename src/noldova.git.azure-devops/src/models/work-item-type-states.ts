/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostWorkItemType, WorkItemCategory } from "@noldova/git.hosting.protocol";

/** A work item type of a project, and the category of each of its states by the state's name. */
export class WorkItemTypeStates {
  public readonly type: HostWorkItemType;
  public readonly categories: ReadonlyMap<string, WorkItemCategory>;

  public constructor(type: HostWorkItemType, categories: ReadonlyMap<string, WorkItemCategory>) {
    this.type = type;
    this.categories = categories;
  }
}
