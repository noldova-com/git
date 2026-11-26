/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type HostChanges, type HostItem, type HostWorkItem, ReferenceState, WorkItemQuery } from "@noldova/git.hosting.protocol";
import { LinkReference, LinkReferenceAction, LinkReferenceAuthor, LinkReferenceColor, LinkReferenceDiff, LinkReferenceImage, LinkReferenceState, LinkReferenceStatus, LinkReferenceTone,
  LinkReferenceWorkItemState } from "@noldova/ui.components.angular";

import type { AzureDevOpsReferenceLink } from "../models/azure-devops-reference-link.ts";
import { Resources } from "../../resources.ts";

export class AzureDevOpsReferenceLooks {
  public static pendingOf({ query }: AzureDevOpsReferenceLink): LinkReference {
    return query instanceof WorkItemQuery
      ? new LinkReference(Resources.formatWorkItemReference(Resources.workItemLabel, query.id), Resources.workItemLabel,
        AzureDevOpsReferenceLooks.imageOf(Resources.descriptionSymbol))
      : new LinkReference(Resources.formatPullRequestReference(query.number), Resources.pullRequestLabel,
        AzureDevOpsReferenceLooks.imageOf(Resources.pullRequestSymbols[ReferenceState.Open]));
  }

  public static workItemOf(item: HostWorkItem, avatar: string | null): LinkReference {
    const { type, assignee, iteration } = item;
    const color = AzureDevOpsReferenceLooks.colorOf(Resources.formatHexColor(type.color));
    const tone = Resources.categoryTones[item.category];
    const image: string | null = Resources.workItemImageOf(type);
    return new LinkReference(Resources.formatWorkItemReference(type.name, item.id), type.name,
      Object.isNull(image) ? AzureDevOpsReferenceLooks.imageOf(Resources.workItemSymbols.get(type.icon) ?? Resources.descriptionSymbol) : new LinkReferenceImage(image, false), {
        state: new LinkReferenceState(type.name, color, color),
        workItemState: new LinkReferenceWorkItemState(item.state, new LinkReferenceTone(tone, tone)),
        title: item.title,
        location: Resources.formatProjectLocation(item.organization, item.project),
        author: Object.isNull(assignee) ? null : new LinkReferenceAuthor(Resources.formatPersonName(assignee), avatar),
        statuses: Object.isNull(iteration) ? [] : [new LinkReferenceStatus(iteration.slice(iteration.lastIndexOf(Resources.iterationSeparator) + 1))],
        time: Object.isNull(item.changedAt) ? null : new Date(item.changedAt),
        itemHref: item.url,
        locationHref: Resources.formatProjectAddress(item.organization, item.project),
        action: new LinkReferenceAction(Resources.branchActionLabel, Resources.formatBranchActionAddress(item.organization, item.id, item.title),
          Resources.branchActionGlyph)
      });
  }

  public static pullRequestOf(item: HostItem, avatar: string | null): LinkReference {
    const { reference, author, state, changes } = item;
    const diff: LinkReferenceDiff | null = Object.isNull(changes) ? null : AzureDevOpsReferenceLooks.diffOf(changes);
    const color = AzureDevOpsReferenceLooks.colorOf(Resources.stateColors[state]);
    return new LinkReference(Resources.formatPullRequestReference(reference.number), Resources.pullRequestLabel,
      AzureDevOpsReferenceLooks.imageOf(Resources.pullRequestSymbols[state]), {
        state: new LinkReferenceState(Resources.stateLabels[state], color, color),
        title: item.title,
        location: Resources.formatPullRequestLocation(reference.owner, reference.number),
        author: Object.isNull(author) ? null : new LinkReferenceAuthor(Resources.formatPersonName(author), avatar),
        time: new Date(item.closedAt ?? item.createdAt),
        diff,
        itemHref: item.url,
        locationHref: Resources.formatOrganizationAddress(reference.owner),
        diffHref: Object.isNull(diff) ? null : Resources.formatPullRequestFilesAddress(item.url)
      });
  }

  private static diffOf(changes: HostChanges): LinkReferenceDiff | null {
    return changes.isCounted ? new LinkReferenceDiff(changes.additions, changes.deletions, changes.changedFiles) : null;
  }

  private static colorOf(color: string): LinkReferenceColor {
    return new LinkReferenceColor(color, Resources.formatFill(color, Resources.fillPercent));
  }

  private static imageOf(svg: string): LinkReferenceImage {
    return new LinkReferenceImage(Resources.svgImagePrefix + encodeURIComponent(svg));
  }
}
