/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { HostReference } from "@noldova/git.hosting.protocol";

import { PullRequestDocument } from "../models/pull-request-document.ts";
import type { WorkItemsPlace } from "../models/work-items-place.ts";
import { Resources } from "../../resources.ts";
import { AzureDevOpsReferenceLinks } from "./azure-devops-reference-links.ts";

/** Opens an Azure DevOps link in its page in the app, where the app has one. */
export class AzureDevOpsPages {
  /**
   * Opens a pull request's link in its page and a work item's in the My work items page, at the work item; a work item's link without a project takes the
   * home's when it's in the home's organization. Returns false, opening nothing, for any other link.
   */
  public static open(context: IWindowPartContext, home: WorkItemsPlace | null, url: string): boolean {
    const link = AzureDevOpsReferenceLinks.of(url);
    if (Object.isNull(link))
      return false;
    const { query } = link;
    if (query instanceof HostReference) {
      context.openDocument(Resources.pullRequestDocument, PullRequestDocument.instanceOf(query), Resources.formatPullRequestReference(query.number));
      return true;
    }
    const homeProject = !Object.isNull(home) && home.organization.toLowerCase() === query.organization.toLowerCase() ? home.project : null;
    const project = link.project ?? homeProject;
    if (Object.isNull(project))
      return false;
    context.openDocument(Resources.workItemsDocument, Resources.formatWorkItemsInstance(query.organization, project, query.id), Resources.myWorkItemsTitle);
    return true;
  }
}
