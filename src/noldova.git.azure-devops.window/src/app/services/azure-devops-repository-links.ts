/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import type { GitRemote } from "@noldova/git.protocol";
import { GitRepositoryLink, type IGitRepositoryLinks } from "@noldova/git.window";

import { WorkItemsPlace } from "../models/work-items-place.ts";
import { Resources } from "../../resources.ts";
import { WorkItemsPages } from "./work-items-pages.ts";

export class AzureDevOpsRepositoryLinks implements IGitRepositoryLinks {
  private readonly context: IWindowPartContext;

  public constructor(context: IWindowPartContext) {
    this.context = context;
  }

  public linksFor(remote: GitRemote): readonly GitRepositoryLink[] {
    const place: WorkItemsPlace | null = WorkItemsPlace.ofRemote(remote);
    if (Object.isNull(place))
      return [];
    const instance: string = Resources.formatWorkItemsInstance(place.organization, place.project, null);
    return [
      new GitRepositoryLink(Resources.workItemsDocument, Resources.myWorkItemsTitle, Resources.workItemsIcon,
        () => this.context.openDocument(Resources.workItemsDocument, instance, Resources.myWorkItemsTitle),
        WorkItemsPages.isActive(place.organization, place.project))
    ];
  }
}
