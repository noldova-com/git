/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostWorkItem, HostWorkItemDetail, HostWorkItemList, HostWorkItemType, WorkItemCategory, WorkItemScope, WorkItemsQuery } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { AzureDevOpsChipItems } from "../../../src/app/services/azure-devops-chip-items.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../fixtures/unhandled-rejections.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";

const PROJECT: string = "Sample Project";

function itemOf(organization: string, id: number): HostWorkItem {
  return new HostWorkItem(AzureDevOpsNames.moduleId, organization, PROJECT, id, new HostWorkItemType("Bug", "CC293D", "icon_insect"), `Item ${id}`, "Active",
    WorkItemCategory.InProgress, `https://dev.azure.com/${organization}/Sample%20Project/_workitems/edit/${id}`, null, null, null, null);
}

function listOf(...items: HostWorkItem[]): HostWorkItemList {
  return new HostWorkItemList(items.map(t => new HostWorkItemDetail(t, null, null, null, null, null, [], [], 0, [])), false);
}

function queryOf(organization: string, ids: readonly number[]): WorkItemsQuery {
  return new WorkItemsQuery(AzureDevOpsNames.moduleId, organization, PROJECT, WorkItemScope.Ids, ids);
}

describe("AzureDevOpsChipItems", () => {
  it("reads the work items a render asks for together, one request for each organization, each item once, and has none until it comes", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    const release = requests.hold(AzureDevOpsNames.readWorkItemsMethod);
    requests.answer(AzureDevOpsNames.readWorkItemsMethod, listOf().toJson());
    const items: AzureDevOpsChipItems = new AzureDevOpsChipItems(context);

    const first = items.itemOf("fabrikam", PROJECT, 4999);
    const missing = items.itemOf("fabrikam", PROJECT, 4702);
    const again = items.itemOf("fabrikam", PROJECT, 4999);
    const other = items.itemOf("contoso", PROJECT, 4999);
    await requests.askedAsync(1);
    const before: HostWorkItem | null = first();
    release(listOf(itemOf("fabrikam", 4999), itemOf("fabrikam", 4800)).toJson());
    await Wait.until(() => expect(first()).toEqual(itemOf("fabrikam", 4999)));
    await requests.askedAsync(2);
    items.itemOf("fabrikam", PROJECT, 4999);

    expect([again === first, before, missing(), other(), requests.payloads]).toEqual([true, null, null, null,
      [queryOf("fabrikam", [4999, 4702]).toJson(), queryOf("contoso", [4999]).toJson()]]);
  });

  it("asks at most 200 ids a request, one request at a time", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    const release = requests.hold(AzureDevOpsNames.readWorkItemsMethod);
    requests.answer(AzureDevOpsNames.readWorkItemsMethod, listOf(itemOf("fabrikam", 201)).toJson());
    const items: AzureDevOpsChipItems = new AzureDevOpsChipItems(context);
    const ids: readonly number[] = Array.from({ length: 201 }, (_, index) => index + 1);

    const last = ids.map(t => items.itemOf("fabrikam", PROJECT, t)).at(-1);
    await requests.askedAsync(1);
    const whileFirstWaits: number = requests.methods.length;
    release(listOf().toJson());
    await Wait.until(() => expect(last?.()).toEqual(itemOf("fabrikam", 201)));

    expect([whileFirstWaits, requests.payloads]).toEqual([1, [queryOf("fabrikam", ids.slice(0, 200)).toJson(), queryOf("fabrikam", [201]).toJson()]]);
  });

  it("logs a read the window fails and keeps no item for the page's life, asking once", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.fail(AzureDevOpsNames.readWorkItemsMethod, new WindowFailure("Not connected."));
    const items: AzureDevOpsChipItems = new AzureDevOpsChipItems(context);

    const item = items.itemOf("fabrikam", PROJECT, 4999);
    await Wait.until(() => expect(context.callsOf("log")).toHaveLength(1));

    expect([item(), items.itemOf("fabrikam", PROJECT, 4999)(), requests.methods, context.callsOf("log").map(t => t[0])]).toEqual([null, null,
      [AzureDevOpsNames.readWorkItemsMethod], ["The Azure DevOps module's git-azure-devops.readWorkItems request failed: WindowFailure: Not connected."]]);
  });

  it("rethrows a failure that isn't the window's", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.fail(AzureDevOpsNames.readWorkItemsMethod, new RangeError("Unexpected."));
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();

    new AzureDevOpsChipItems(context).itemOf("fabrikam", PROJECT, 4999);

    expect(await rejection).toBeInstanceOf(RangeError);
  });
});
