/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { GitFolderParams, GitGraph, GitNames, GitStatus } from "@noldova/git.protocol";
import { GitFolder } from "@noldova/git.window";
import { describe, expect, it, onTestFinished } from "vitest";

import { WorkItemSelection } from "../../../../src/app/services/work-item-selection.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { Wait } from "../../../fixtures/wait.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";
import { azureStatus, detailOf, epicItem, githubStatus, INSTANCE, listOf, mine, mineQuery, noMessages, Page, urlOf } from "../../../fixtures/work-items-page.fixture.ts";

describe("AzureDevOpsWorkItemComponent", () => {
  it("reads the signed-in person's open work items in the instance's project and lists them as a hierarchy, each with its state, sprint and links",
    async () => {
      const page = await new Page().answerMine().openAsync();

      expect(page.requests.payloads[0]).toEqual(mineQuery().toJson());
      expect(page.texts(".item")).toEqual([
        "workspace_premium 4702 expand_more Note sharing and sync Active Sprint 47 none",
        "emoji_events 4790 expand_more Markdown export Active Sprint 47 1 child",
        "menu_book 4821 expand_more Export notes as Markdown files Active Sprint 47 !482",
        "assignment 4831 Read local times from the app settings Active Sprint 47 1 commit",
        "assignment 4832 Tag filter ignores case in note titles New Sprint 47 none",
        "description 4811 Note due dates show UTC times Resolved — !479"
      ]);
      expect([...page.element.querySelectorAll<HTMLElement>(".item .cell-title")].map(t => t.style.paddingLeft))
        .toEqual(["0rem", "1rem", "2rem", "3rem", "3rem", "0rem"]);
      expect(page.texts(".head")).toEqual(["My work items · Sample Project filter_list Type: all State: not closed add New work item"]);
      expect(page.texts(".wrow.caps")).toEqual(["ID Title State Iteration Links"]);
    });

  it("colors each row's icon in its type's color and its state's dot by the state's category", async () => {
    const page = await new Page().answerMine().openAsync();
    const icons = [...page.element.querySelectorAll<HTMLElement>(".item .wi")].map(t => t.style.color);
    const dots = [...page.element.querySelectorAll<HTMLElement>(".item .dot")].map(t => t.style.backgroundColor);

    expect(icons[2]).toBe("rgb(0, 156, 204)");
    expect(dots).toEqual(["var(--nol-accent)", "var(--nol-accent)", "var(--nol-accent)", "var(--nol-accent)", "var(--nol-text-muted)", "var(--nol-warning)"]);
  });

  it("shows the first work item's detail until another row is chosen by click or key, marking the chosen row", async () => {
    const page = new Page().answerMine();
    page.requests.answer(AzureDevOpsNames.readWorkItemsMethod, listOf([]));
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, null);
    await page.openAsync();

    expect(page.find(".detail").getAttribute("aria-label")).toBe("Work item 4702");
    expect(page.texts(".item[aria-selected=true]")).toEqual([expect.stringContaining("4702")]);
    await page.clickAsync(".item:nth-of-type(3)");
    expect(page.find(".detail").getAttribute("aria-label")).toBe("Work item 4790");
    page.element.querySelectorAll<HTMLElement>(".item")[4]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await page.settleAsync();
    expect(page.find(".detail").getAttribute("aria-label")).toBe("Work item 4832");
    page.element.querySelectorAll<HTMLElement>(".item")[5]?.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    await page.settleAsync();
    expect(page.texts(".item.sel")).toEqual([expect.stringContaining("4811")]);
  });

  it("finds the project from the open repository's Azure DevOps remote when the instance names none", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/portal-web")));
    const page = new Page();
    page.requests.answer(GitNames.statusMethod, azureStatus.toJson(), azureStatus.toJson());
    page.requests.answer(GitNames.graphMethod, new GitGraph([], false).toJson());
    page.requests.answer(GitNames.messageReferencesMethod, noMessages);
    page.answerMine();
    await page.openAsync("");

    expect([...page.requests.methods].map(String).sort()).toEqual([GitNames.graphMethod, GitNames.messageReferencesMethod, AzureDevOpsNames.readWorkItemsMethod,
      GitNames.statusMethod, GitNames.statusMethod].sort());
    expect(page.requests.payloads.filter((_, i) => ![GitNames.graphMethod, GitNames.messageReferencesMethod].includes(String(page.requests.methods[i])))).toEqual([new GitFolderParams("/work/portal-web").toJson(),
      new GitFolderParams("/work/portal-web").toJson(), mineQuery().toJson()]);
    expect(page.texts(".item")).toHaveLength(6);
  });

  it("says so, without asking anything, when the instance names no project and no repository is open", async () => {
    const page = await new Page().openAsync("");

    expect(page.text).toBe("Open a repository with an Azure DevOps remote to see its project's work items.");
    expect(page.requests.methods).toEqual([]);
  });

  it("says so, without asking Azure DevOps, when the open repository has no Azure DevOps remote", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/site")));
    const page = new Page();
    page.requests.answer(GitNames.statusMethod, githubStatus.toJson(), githubStatus.toJson());
    await page.openAsync("");

    expect(page.text).toBe("Open a repository with an Azure DevOps remote to see its project's work items.");
    expect(page.requests.methods).toEqual([GitNames.statusMethod, GitNames.statusMethod]);
  });

  it("says so, without asking Azure DevOps, for an instance that isn't a project, even with a repository open", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/site")));
    const page = new Page();
    page.requests.answer(GitNames.statusMethod, githubStatus.toJson());
    await page.openAsync("fabrikam");

    expect(page.text).toBe("Open a repository with an Azure DevOps remote to see its project's work items.");
    expect(page.requests.methods).toEqual([GitNames.statusMethod]);
  });

  it("lists each type and state read in its menu and shows only the work items with the chosen ones, its chip naming the choice", async () => {
    const page = await new Page().answerMine().openAsync();

    expect(await page.chooseAsync(".type-menu", "Task")).toEqual(["* All", "Epic", "Feature", "Issue", "Task", "User Story"]);
    expect([page.ids, page.texts(".type-menu")]).toEqual([["4831", "4832"], ["filter_list Type: Task"]]);
    expect(await page.chooseAsync(".state-menu", "New")).toEqual(["* All", "Active", "New", "Resolved"]);
    expect([page.ids, page.texts(".state-menu"), page.texts(".detail-title")]).toEqual([["4832"], ["State: New"], ["Tag filter ignores case in note titles"]]);
    expect(await page.chooseAsync(".type-menu", "All")).toEqual(["All", "Epic", "Feature", "Issue", "* Task", "User Story"]);
    expect([page.ids, page.texts(".type-menu")]).toEqual([["4832"], ["filter_list Type: all"]]);
  });

  it("clears the filters when it reads another instance", async () => {
    const page = await new Page().answerMine().answerMine().openAsync();
    await page.chooseAsync(".type-menu", "Task");

    page.fixture?.componentRef.setInput("instance", "fabrikam/Sample%20Project/4702");
    await page.requests.askedAsync(2);
    await page.settleAsync();

    expect([page.texts(".type-menu"), page.ids]).toEqual([["filter_list Type: all"], ["4702", "4790", "4821", "4831", "4832", "4811"]]);
  });

  it("says the list and its filters cover only the work items read when Azure DevOps stopped at its limit, until a full list is read", async () => {
    const page = await new Page().answerMine(mine, true).answerMine().openAsync();
    const capped: readonly string[] = page.texts(".capped");

    page.fixture?.componentRef.setInput("instance", "fabrikam/Sample%20Project/4702");
    await page.requests.askedAsync(2);
    await page.settleAsync();

    expect([capped, page.texts(".capped")]).toEqual([["Azure DevOps answered its first 200 work items, so the list and its filters cover only those."], []]);
  });

  it("says no open work items are assigned when Azure DevOps lists none", async () => {
    const page = await new Page().answerMine([]).openAsync();

    expect(page.texts(".empty")).toEqual(["No open work items are assigned to you here. If you aren't signed in, sign in in Settings → Accounts and hosts."]);
    expect(page.element.querySelector(".detail")).toBeNull();
  });

  it("says it is reading until the answer comes", async () => {
    const page = new Page();
    const release = page.requests.hold(AzureDevOpsNames.readWorkItemsMethod);
    page.open();
    await page.requests.askedAsync(1);

    await Wait.until(() => expect(page.text).toBe("Reading your work items on Azure DevOps."));
    release(listOf([]));
    await page.settleAsync();
    expect(page.texts(".empty")).toHaveLength(1);
  });

  it("logs a read the window fails, offers to try again, and lists what the retry reads", async () => {
    const page = new Page();
    page.requests.fail(AzureDevOpsNames.readWorkItemsMethod, new WindowFailure("The runtime stopped."));
    page.answerMine();
    await page.openAsync();

    expect(page.texts("[role=alert]")).toEqual(["error Azure DevOps didn't answer, so your work items couldn't be read. Try again"]);
    expect(page.logs).toEqual([`The Azure DevOps module's ${AzureDevOpsNames.readWorkItemsMethod} request failed: WindowFailure: The runtime stopped.`]);
    await page.clickAsync("[role=alert] button");
    expect(page.texts(".item")).toHaveLength(6);
  });

  it("logs a repository read the window fails under the status method", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/portal-web")));
    const page = new Page();
    page.requests.fail(GitNames.statusMethod, new WindowFailure("No repository."));
    page.requests.fail(GitNames.statusMethod, new WindowFailure("No repository."));
    await page.openAsync("");

    expect(page.logs).toEqual([`The Azure DevOps module's ${GitNames.statusMethod} request failed: WindowFailure: No repository.`,
      `The Azure DevOps module's ${GitNames.statusMethod} request failed: WindowFailure: No repository.`]);
    expect(page.texts("[role=alert]")).toHaveLength(1);
  });

  it("rethrows a failure that isn't the window's while it reads", async () => {
    const page = new Page();
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    page.requests.fail(AzureDevOpsNames.readWorkItemsMethod, new RangeError("Unexpected."));
    await page.openAsync();

    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("reads again for another instance, and drops a list, a repository or a failure for the one it left", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/portal-web")));
    const page = new Page();
    const releaseStatus = page.requests.hold(GitNames.statusMethod);
    page.requests.answer(GitNames.statusMethod, githubStatus.toJson());
    const releaseList = page.requests.hold(AzureDevOpsNames.readWorkItemsMethod);
    const failList = page.requests.holdFailure(AzureDevOpsNames.readWorkItemsMethod);
    page.answerMine([detailOf(epicItem)]);
    page.open("");
    await page.requests.askedAsync(2);

    page.fixture?.componentRef.setInput("instance", INSTANCE);
    await page.requests.askedAsync(3);
    page.fixture?.componentRef.setInput("instance", "fabrikam/Web");
    await page.requests.askedAsync(4);
    page.fixture?.componentRef.setInput("instance", "fabrikam/Sample%20Project/4702");
    await page.requests.askedAsync(5);
    releaseStatus(new GitStatus("main", null, null, [], false, "f1", null, null).toJson());
    releaseList(listOf(mine));
    failList(new WindowFailure("Late."));
    await Wait.until(() => expect(page.texts(".item")).toHaveLength(1));

    expect(page.texts(".item")).toEqual([expect.stringContaining("4702")]);
    expect(page.texts("[role=alert]")).toEqual([]);
  });

  it("opens the work item, a new work item page and its project's work items on Azure DevOps, and logs a page the window can't open", async () => {
    const page = await new Page().answerMine().openAsync();
    let calls = 0;
    page.context.answer("openLinkAsync", async () => {
      calls++;
      if (calls === 2)
        throw new WindowFailure("No browser.");
    });

    await page.clickAsync(".open");
    await page.clickAsync(".new");
    await Wait.until(() => expect(page.logs).toHaveLength(1));

    expect(page.links).toEqual([urlOf(4702), "https://dev.azure.com/fabrikam/Sample%20Project/_workitems"]);
    expect(page.logs).toEqual(["The Azure DevOps module couldn't open https://dev.azure.com/fabrikam/Sample%20Project/_workitems: WindowFailure: No browser."]);
  });

  it.each([".new", ".open"])("rethrows a failure to open a page that isn't the window's, from %s", async selector => {
    const page = await new Page().answerMine().openAsync();
    page.context.answer("openLinkAsync", async () => {
      throw new RangeError("Unexpected.");
    });
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();

    await page.clickAsync(selector);

    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("opens the Work item view once for the first work item shown, and brings it to the front, retitled, for each row chosen, never moving the focus", async () => {
    const page = new Page().answerMine();
    page.requests.answer(AzureDevOpsNames.readWorkItemsMethod, listOf([]));
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, null);
    await page.openAsync();
    const opened: readonly unknown[] = [...page.context.callsOf("openView")];
    await page.clickAsync(".item:nth-of-type(3)");

    expect([opened, page.context.callsOf("openView"), page.context.callsOf("showView"), page.context.callsOf("updateView").at(-1)]).toEqual([
      [["git-azure-devops.workItemDetail", "selected", "Work item 4702"]],
      [["git-azure-devops.workItemDetail", "selected", "Work item 4702"], ["git-azure-devops.workItemDetail", "selected", "Work item 4790"]], [],
      ["git-azure-devops.workItemDetail", "selected", { title: "Work item 4790" }]]);
  });

  it("opens the view again for each row chosen after the person closed it", async () => {
    const page = new Page().answerMine();
    page.requests.answer(AzureDevOpsNames.readWorkItemsMethod, listOf([]));
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, null);
    await page.openAsync();
    WorkItemSelection.of(page.context).listen();
    page.context.raiseViewClosed("git-azure-devops.workItemDetail", "selected");
    page.element.querySelectorAll<HTMLElement>(".item")[4]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await page.settleAsync();
    await page.clickAsync(".item:nth-of-type(3)");

    expect(page.context.callsOf("openView").map(t => t[2])).toEqual(["Work item 4702", "Work item 4832", "Work item 4790"]);
  });

  it("opens no view for a document that isn't in front, and the view shows its work item only once it is", async () => {
    const page = new Page().answerMine();
    page.active.set(false);
    page.requests.answer(AzureDevOpsNames.readWorkItemsMethod, listOf([]));
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, null);
    await page.openAsync();
    const before: readonly unknown[] = [page.context.callsOf("openView").length, page.texts(".empty-view")];
    page.active.set(true);
    await page.settleAsync();

    expect([before, page.context.callsOf("openView").length, page.find(".detail").getAttribute("aria-label")]).toEqual([[0, ["Select a work item to see it here."]], 1,
      "Work item 4702"]);
  });
});
