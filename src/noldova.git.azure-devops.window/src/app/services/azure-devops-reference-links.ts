/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostReference, WorkItemQuery } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";
import { LinkReferenceMatch } from "@noldova/ui.components.angular";

import { Resources } from "../../resources.ts";
import { AzureDevOpsReferenceLink } from "../models/azure-devops-reference-link.ts";

export class AzureDevOpsReferenceLinks {
  public static of(url: string): AzureDevOpsReferenceLink | null {
    const address = URL.parse(url);
    if (Object.isNull(address) || address.protocol !== Resources.referenceProtocol || address.port.length > 0 || address.username.length > 0
      || address.password.length > 0)
      return null;
    const segments = address.pathname.split(Resources.slash).slice(1);
    if (segments.at(-1) === String.empty)
      segments.pop();
    const place = AzureDevOpsReferenceLinks.placeOf(address.hostname, segments);
    if (Object.isNull(place) || !Resources.organizationPattern.test(place[0]))
      return null;
    const [organization, path] = place;
    const workItem = Resources.workItemPathPattern.exec(path);
    if (!Object.isNull(workItem)) {
      const id = Number(workItem[2]);
      return new AzureDevOpsReferenceLink(new WorkItemQuery(AzureDevOpsNames.moduleId, organization, id), Resources.formatWorkItemKey(organization, id),
        AzureDevOpsReferenceLinks.decode(workItem[1]));
    }
    const pullRequest = Resources.pullRequestPathPattern.exec(path);
    if (Object.isNull(pullRequest))
      return null;
    return AzureDevOpsReferenceLinks.ofPullRequest(new HostReference(AzureDevOpsNames.moduleId, organization, String(pullRequest[1]).toLowerCase(),
      Number(pullRequest[2])));
  }

  /** The link to a pull request its reference names, kept under the key its address by the repository's id gives. */
  public static ofPullRequest(reference: HostReference): AzureDevOpsReferenceLink {
    return new AzureDevOpsReferenceLink(reference, Resources.formatPullRequestKey(reference.owner, reference.repository, reference.number));
  }

  /** The organization and project an Azure DevOps page's address names, such as a pull request's; null for another address or one that names no project. */
  public static projectOf(url: string): readonly [string, string] | null {
    const address = URL.parse(url);
    if (Object.isNull(address) || !Resources.webProtocols.includes(address.protocol))
      return null;
    const place = AzureDevOpsReferenceLinks.placeOf(address.hostname, address.pathname.split(Resources.slash).slice(1));
    const project = Object.isNull(place) ? null : AzureDevOpsReferenceLinks.decode(Resources.pageProjectPattern.exec(place[1])?.[1]);
    return Object.isNull(place) || Object.isNull(project) || !Resources.organizationPattern.test(place[0]) ? null : [place[0], project];
  }

  public static inText(text: string, home: string | null): readonly LinkReferenceMatch[] {
    if (Object.isNull(home))
      return [];
    return [...text.matchAll(Resources.textReferencePattern)].map(t => new LinkReferenceMatch(t.index, t[0].length,
      Resources.formatWorkItemAddress(home, Number(t[0].slice(t[0].indexOf(Resources.textNumberMark) + 1)))));
  }

  public static homeOf(remote: GitRemote | null): string | null {
    if (Object.isNull(remote))
      return null;
    const { host, path } = remote;
    if (Object.isNull(host) || Object.isNull(path))
      return null;
    const organization = AzureDevOpsReferenceLinks.organizationOf(host, path);
    return Object.isNull(organization) || !Resources.organizationPattern.test(organization) ? null : organization;
  }

  public static organizationIn(text: string): string | null {
    const typed = text.trim();
    if (Resources.organizationPattern.test(typed))
      return typed;
    const address = URL.parse(typed.includes(Resources.schemeMark) ? typed : `${Resources.referenceProtocol}//${typed}`);
    if (Object.isNull(address) || !Resources.webProtocols.includes(address.protocol))
      return null;
    const place = AzureDevOpsReferenceLinks.placeOf(address.hostname, address.pathname.split(Resources.slash).slice(1));
    return Object.isNull(place) || !Resources.organizationPattern.test(place[0]) ? null : place[0];
  }

  public static isVisualStudio(remote: GitRemote): boolean {
    return !Object.isNull(remote.host) && remote.host.endsWith(Resources.visualStudioSuffix);
  }

  private static decode(segment: string | undefined): string | null {
    if (Object.isUndefined(segment))
      return null;
    try {
      return decodeURIComponent(segment);
    }
    catch (error) {
      if (error instanceof URIError)
        return null;
      throw error;
    }
  }

  private static placeOf(host: string, segments: readonly string[]): readonly [string, string] | null {
    if (host === Resources.azureHost)
      return [segments[0] ?? String.empty, segments.slice(1).join(Resources.slash)];
    if (!host.endsWith(Resources.visualStudioSuffix))
      return null;
    const path = segments[0]?.toLowerCase() === Resources.defaultCollection ? segments.slice(1) : segments;
    return [host.slice(0, -Resources.visualStudioSuffix.length), path.join(Resources.slash)];
  }

  private static organizationOf(host: string, path: string): string | null {
    if (host === Resources.azureHost)
      return Resources.remoteWebPathPattern.exec(path)?.[1] ?? null;
    if (host === Resources.azureSshHost || host === Resources.visualStudioSshHost)
      return Resources.remoteSshPathPattern.exec(path)?.[1] ?? null;
    return host.endsWith(Resources.visualStudioSuffix) && Resources.remoteCollectionPathPattern.test(path) ? host.slice(0, -Resources.visualStudioSuffix.length) : null;
  }
}
