/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { WorkItemsPlace } from "../../../src/app/models/work-items-place.ts";
import { AzureDevOpsPages } from "../../../src/app/services/azure-devops-pages.ts";

const home: WorkItemsPlace = new WorkItemsPlace("Fabrikam", "Sample Project", null);

describe("AzureDevOpsPages", () => {
  it("opens a pull request's address as its page, its repository's id in lower case, titled with its number", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();

    expect(AzureDevOpsPages.open(context, null, "https://dev.azure.com/fabrikam/web/_git/3F2504E0-4F89-11D3-9A0C-0305E82C3301/pullrequest/482")).toBe(true);
    expect(context.callsOf("openDocument")).toEqual([["git-azure-devops.pullRequest", "fabrikam/3f2504e0-4f89-11d3-9a0c-0305e82c3301/482", "!482"]]);
  });

  it("opens a work item's address in the My work items page of its own project, or of the open repository's project when the address names none in the same organization", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();

    const opened = [AzureDevOpsPages.open(context, home, "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/42"),
      AzureDevOpsPages.open(context, home, "https://fabrikam.visualstudio.com/_workitems/edit/43")];

    expect(opened).toEqual([true, true]);
    expect(context.callsOf("openDocument")).toEqual([["git-azure-devops.workItems", "fabrikam/Web%20Site/42", "My work items"],
      ["git-azure-devops.workItems", "fabrikam/Sample%20Project/43", "My work items"]]);
  });

  it("opens nothing for an address that isn't Azure DevOps's, or a work item with no project to open it in", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();

    const opened = [AzureDevOpsPages.open(context, home, "https://github.com/fabrikam/web/pull/7"),
      AzureDevOpsPages.open(context, null, "https://fabrikam.visualstudio.com/_workitems/edit/43"),
      AzureDevOpsPages.open(context, new WorkItemsPlace("contoso", "Web", null), "https://fabrikam.visualstudio.com/_workitems/edit/43")];

    expect([opened, context.callsOf("openDocument")]).toEqual([[false, false, false], []]);
  });
});
