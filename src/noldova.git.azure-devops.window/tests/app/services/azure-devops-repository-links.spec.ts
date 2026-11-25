/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { WorkItemsPlace } from "../../../src/app/models/work-items-place.ts";
import { AzureDevOpsRepositoryLinks } from "../../../src/app/services/azure-devops-repository-links.ts";
import { WorkItemsPages } from "../../../src/app/services/work-items-pages.ts";

describe("AzureDevOpsRepositoryLinks", () => {
  it("links an Azure DevOps repository to its project's work items, opening the My work items document for the project", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const links = new AzureDevOpsRepositoryLinks(context).linksFor(new GitRemote("origin", "dev.azure.com", "fabrikam/Sample%20Project/_git/garden-web",
      RemoteTransport.Https));

    for (const link of links)
      link.open();

    expect(links.map(t => [t.key, t.label, t.icon])).toEqual([["git-azure-devops.workItems", "My work items", "checklist"]]);
    expect(context.callsOf("openDocument")).toEqual([["git-azure-devops.workItems", "fabrikam/Sample%20Project", "My work items"]]);
  });

  it("selects the row while a page of its project's work items is the active document", () => {
    const [link] = new AzureDevOpsRepositoryLinks(new FakeWindowPartContext()).linksFor(new GitRemote("origin", "dev.azure.com",
      "fabrikam/Sample%20Project/_git/garden-web", RemoteTransport.Https));
    const before: boolean | undefined = link?.isActive();
    const unfollow = WorkItemsPages.follow(signal(new WorkItemsPlace("fabrikam", "Sample Project", null)), signal(true));
    const shown: boolean | undefined = link?.isActive();
    unfollow();

    expect([before, shown, link?.isActive()]).toEqual([false, true, false]);
  });

  it("gives no links for a remote on another host, and opens nothing", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();

    expect(new AzureDevOpsRepositoryLinks(context).linksFor(new GitRemote("origin", "github.com", "example-owner/site", RemoteTransport.Https))).toEqual([]);
    expect(context.callsOf("openDocument")).toEqual([]);
  });
});
