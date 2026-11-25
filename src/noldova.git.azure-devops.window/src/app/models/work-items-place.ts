/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { GitRemote } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { AzureDevOpsReferenceLinks } from "../services/azure-devops-reference-links.ts";
import type { ProjectPlace } from "./project-place.ts";

export class WorkItemsPlace {
  public readonly organization: string;
  public readonly project: string;
  public readonly id: number | null;

  public constructor(organization: string, project: string, id: number | null) {
    this.organization = organization;
    this.project = project;
    this.id = id;
  }

  public get instance(): string {
    return Resources.formatWorkItemsInstance(this.organization, this.project, this.id);
  }

  public static ofInstance(instance: string): WorkItemsPlace | null {
    const parts = Resources.workItemsInstancePattern.exec(instance)?.groups;
    if (Object.isUndefined(parts))
      return null;
    const organization: string | undefined = parts["organization"];
    const project: string | null = WorkItemsPlace.decode(parts["project"]);
    if (Object.isUndefined(organization) || Object.isNull(project) || !Resources.organizationPattern.test(organization))
      return null;
    const id: string | undefined = parts["id"];
    return new WorkItemsPlace(organization, project, Object.isUndefined(id) ? null : Number(id));
  }

  public static ofRemote(remote: GitRemote | null): WorkItemsPlace | null {
    const organization: string | null = AzureDevOpsReferenceLinks.homeOf(remote);
    const project: string | null = WorkItemsPlace.decode(WorkItemsPlace.projectPatternOf(remote?.host ?? null).exec(remote?.path ?? "")?.[1]);
    return Object.isNull(organization) || Object.isNull(project) ? null : new WorkItemsPlace(organization, project, null);
  }

  /** The organization and project an Azure DevOps page's address names, such as a pull request's, without a work item; null when it names none. */
  public static ofPage(url: string): WorkItemsPlace | null {
    const place: ProjectPlace | null = AzureDevOpsReferenceLinks.projectOf(url);
    return Object.isNull(place) ? null : new WorkItemsPlace(place.organization, place.project, null);
  }

  /** The decoded name in a URL or remote path, or `null` when there is none, it's blank, or it doesn't decode. */
  public static decode(text: string | undefined): string | null {
    if (Object.isUndefined(text))
      return null;
    try {
      const decoded: string = decodeURIComponent(text);
      return decoded.trim() === "" ? null : decoded;
    }
    catch (error) {
      if (error instanceof URIError)
        return null;
      throw error;
    }
  }

  private static projectPatternOf(host: string | null): RegExp {
    if (host === Resources.azureHost)
      return Resources.remoteWebProjectPattern;
    return host === Resources.azureSshHost || host === Resources.visualStudioSshHost ? Resources.remoteSshProjectPattern
      : Resources.remoteCollectionProjectPattern;
  }
}
