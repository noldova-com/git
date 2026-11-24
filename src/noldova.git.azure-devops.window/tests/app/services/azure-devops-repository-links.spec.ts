/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { AzureDevOpsRepositoryLinks } from "../../../src/app/services/azure-devops-repository-links.ts";

describe("AzureDevOpsRepositoryLinks", () => {
  it("links an Azure DevOps repository to its project's work items, opening the My work items document for the project", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const links = new AzureDevOpsRepositoryLinks(context).linksFor(new GitRemote("origin", "dev.azure.com", "fabrikam/Sample%20Project/_git/portal-web",
      RemoteTransport.Https));

    for (const link of links)
      link.open();

    expect(links.map(t => [t.key, t.label, t.icon])).toEqual([["git-azure-devops.workItems", "My work items", "checklist"]]);
    expect(context.callsOf("openDocument")).toEqual([["git-azure-devops.workItems", "fabrikam/Sample%20Project", "My work items"]]);
  });

  it("gives no links for a remote on another host, and opens nothing", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();

    expect(new AzureDevOpsRepositoryLinks(context).linksFor(new GitRemote("origin", "github.com", "example-owner/site", RemoteTransport.Https))).toEqual([]);
    expect(context.callsOf("openDocument")).toEqual([]);
  });
});
