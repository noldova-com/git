/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { HostWorkItem, HostWorkItemType, WorkItemCategory, WorkItemQuery } from "@noldova/git.hosting.protocol";
import type { LinkReference } from "@noldova/ui.components.angular";
import { describe, expect, it } from "vitest";

import { AzureDevOpsReferenceLink } from "../../../src/app/models/azure-devops-reference-link.ts";
import { AzureDevOpsReferenceRead } from "../../../src/app/models/azure-devops-reference-read.ts";
import { AzureDevOpsReferenceLooks } from "../../../src/app/services/azure-devops-reference-looks.ts";

const link: AzureDevOpsReferenceLink = new AzureDevOpsReferenceLink(new WorkItemQuery("git-azure-devops", "fabrikam", 42), "fabrikam#42");
const pending: LinkReference = AzureDevOpsReferenceLooks.pendingOf(link);
const item: LinkReference = AzureDevOpsReferenceLooks.workItemOf(new HostWorkItem("git-azure-devops", "fabrikam", "web", 42,
  new HostWorkItemType("Bug", "CC293D", "icon_insect"), "The greeting is cut short", "Active", WorkItemCategory.InProgress,
  "https://dev.azure.com/fabrikam/web/_workitems/edit/42", null, null, null, null), null);

describe("AzureDevOpsReferenceRead", () => {
  it("shows the pending look until a read shows the item, and holds its link", () => {
    const read = new AzureDevOpsReferenceRead(link, pending);
    const before: LinkReference | null = read.item();

    const shown: boolean = read.show(read.start(), item);

    expect([read.link, before, shown, read.item()]).toEqual([link, pending, true, item]);
  });

  it("drops an older read's answer once a newer read started", () => {
    const read = new AzureDevOpsReferenceRead(link, pending);
    const first: number = read.start();
    const second: number = read.start();

    expect([read.show(first, item), read.item(), read.show(second, null), read.item()]).toEqual([false, pending, true, null]);
  });

  it("shows the pending look again when a new read starts after one found nothing", () => {
    const read = new AzureDevOpsReferenceRead(link, pending);
    read.show(read.start(), null);

    read.start();

    expect(read.item()).toBe(pending);
  });

  it("keeps the item shown when a new read starts after one found it", () => {
    const read = new AzureDevOpsReferenceRead(link, pending);
    read.show(read.start(), item);

    read.start();

    expect(read.item()).toBe(item);
  });

  it("goes back to the pending look when stopped, and drops the answer of the read it stopped", () => {
    const read = new AzureDevOpsReferenceRead(link, pending);
    const attempt: number = read.start();
    read.show(attempt, item);

    read.stop();

    expect([read.item(), read.show(attempt, item), read.item()]).toEqual([pending, false, pending]);
  });
});
