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
import { HostPolicy, HostPullRequest, HostWorkItem, HostWorkItemDetail, HostWorkItemType, PolicyState, WorkItemCategory, WorkItemScope, WorkItemsQuery } from "@noldova/git.hosting.protocol";
import { GitCommit, GitGraph, GitGraphCommit, GitGraphParams, GitNames } from "@noldova/git.protocol";
import { GitFolder } from "@noldova/git.window";
import { describe, expect, it, onTestFinished } from "vitest";

import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { Wait } from "../../../fixtures/wait.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";
import { azureStatus, bug, childrenQuery, detailOf, githubStatus, history, HOST, INSTANCE, itemOf, listOf, messages, noMessages, Page, pr482, PROJECT,
  pullRequest, story, task, tasks, urlOf } from "../../../fixtures/work-items-page.fixture.ts";

describe("AzureDevOpsWorkItemDetailComponent", () => {
  it("shows the instance's work item with its fields, acceptance criteria, tasks with their hours, and its development", async () => {
    const page = new Page().answerMine();
    page.requests.answer(AzureDevOpsNames.readWorkItemsMethod, listOf(tasks));
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
    await page.openAsync(`${INSTANCE}/7521`);
    await page.requests.askedAsync(3);
    await page.settleAsync();

    expect(page.requests.payloads.slice(1)).toEqual([childrenQuery([7530, 7531, 7532]).toJson(), pr482.toJson()]);
    expect(page.texts(".kind")).toEqual(["menu_book User Story 7521 open_in_new"]);
    expect(page.texts(".detail-title")).toEqual(["Export notes as Markdown files"]);
    expect(page.texts(".fields")).toEqual(["State Active Assigned K kim@fabrikam.com Iteration Sample Project\\Sprint 17 Area Sample Project\\Notes app"
      + " Points 5 Parent emoji_events 7490 Markdown export"]);
    expect(page.texts(".acceptance")).toEqual(["Acceptance criteria Readers see a due date 48 h and 2 h before it is due."]);
    expect(page.texts(".section")).toEqual([
      "Tasks 6 h of 14 h left assignment 7530 Note card with tag chips 0 h assignment 7531 Local times from settings 2 h"
      + " assignment 7532 Tag filter ignores letter case 4 h",
      "Development alt_route users/kim/7521-export-notes-markdown merge !752 · 3 of 4 policies error commit five commits on this branch"
    ]);
    expect(page.texts(".actions")).toEqual(["alt_route Create branch"]);
  });

  it("shows a work item with nothing planned, linked or assigned plainly, its unread parent by id", async () => {
    const page = new Page().answerMine();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, null);
    await page.openAsync(`${INSTANCE}/7511`);
    await page.requests.askedAsync(2);
    await page.settleAsync();

    expect(page.texts(".fields")).toEqual(["State Resolved Assigned Unassigned Iteration — Area — Points — Parent 7699"]);
    expect(page.texts(".acceptance")).toEqual([]);
    expect(page.texts(".section")).toEqual([expect.stringMatching(/^Development merge !479$/)]);
    expect(page.requests.methods).toEqual([AzureDevOpsNames.readWorkItemsMethod, AzureDevOpsNames.readPullRequestMethod]);
  });

  it("draws the work item's type icon as Azure DevOps drew it, 0.875rem square inside the 1rem symbol it stands in for, before the type's name", async () => {
    const svg: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#009CCC" d="M2 2h12v12H2z"/></svg>';
    const top = detailOf(new HostWorkItem(HOST, "fabrikam", PROJECT, 4900, new HostWorkItemType("User Story", "009CCC", "icon_book", svg), "Alone", "New",
      WorkItemCategory.Proposed, urlOf(4900), null, null, null, null));
    const page = await new Page().answerMine([top]).openAsync();
    const image = page.find(".kind img.type-image");
    const box = image.getBoundingClientRect();
    const name = page.find(".kind .small").getBoundingClientRect();
    const rem: number = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

    expect([image.getAttribute("src"), page.element.querySelector(".kind span.wi")]).toEqual([`data:image/svg+xml,${encodeURIComponent(svg)}`, null]);
    expect([box.width / rem, box.height / rem, box.right <= name.left]).toEqual([0.875, 0.875, true]);
  });

  it("says no development is linked, and shows no parent, for a top work item with nothing linked", async () => {
    const top = detailOf(new HostWorkItem(HOST, "fabrikam", PROJECT, 4900, story, "Alone", "New", WorkItemCategory.Proposed, urlOf(4900), null, null,
      null, null));
    const page = await new Page().answerMine([top]).openAsync();

    expect(page.texts(".fields")).toEqual([expect.stringContaining("Parent —")]);
    expect(page.texts(".section")).toEqual(["Development No branch, pull request or commit is linked yet."]);
  });

  it("lists tasks without hours when the host records none, and leaves out a pull request's policies when none blocks or none was read", async () => {
    const page = new Page().answerMine();
    page.requests.answer(AzureDevOpsNames.readWorkItemsMethod, listOf([detailOf(itemOf(7530, task, "Card", "New", WorkItemCategory.Proposed, 7521))]));
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, new HostPullRequest(pullRequest.item, [], [
      new HostPolicy("Optional check", PolicyState.Rejected, false, null)], [], false, "", null, []).toJson());
    await page.openAsync(`${INSTANCE}/7521`);
    await page.requests.askedAsync(3);
    await page.settleAsync();

    expect(page.texts(".section")[0]).toBe("Tasks assignment 7530 Card");
    expect(page.texts(".section")[1]).toContain("merge !752 commit");
    expect(page.element.querySelector(".warning")).toBeNull();
  });

  it("shows a pull request without its policies when Azure DevOps shows none for it", async () => {
    const page = new Page().answerMine();
    page.requests.answer(AzureDevOpsNames.readPullRequestMethod, null);
    await page.openAsync(`${INSTANCE}/7511`);
    await page.requests.askedAsync(2);
    await page.settleAsync();

    expect(page.texts(".section")).toEqual(["Development merge !479"]);
  });

  it("logs a task or pull request read the window fails, and still shows the rest of the work item", async () => {
    const page = new Page().answerMine();
    page.requests.fail(AzureDevOpsNames.readWorkItemsMethod, new WindowFailure("Busy."));
    page.requests.fail(AzureDevOpsNames.readPullRequestMethod, new WindowFailure("Gone."));
    await page.openAsync(`${INSTANCE}/7521`);
    await page.requests.askedAsync(3);
    await page.settleAsync();

    expect(page.logs).toEqual([`The Azure DevOps module's ${AzureDevOpsNames.readWorkItemsMethod} request failed: WindowFailure: Busy.`,
      `The Azure DevOps module's ${AzureDevOpsNames.readPullRequestMethod} request failed: WindowFailure: Gone.`]);
    expect(page.texts(".section")).toEqual([expect.stringMatching(/^Development .* merge !752 commit five commits on this branch$/)]);
  });

  it("rethrows a failure of a task read that isn't the window's", async () => {
    const page = new Page().answerMine();
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    page.requests.fail(AzureDevOpsNames.readWorkItemsMethod, new RangeError("Unexpected."));
    await page.openAsync(`${INSTANCE}/7490`);

    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("drops tasks and a pull request read for a work item that is no longer chosen", async () => {
    const page = new Page().answerMine();
    const releaseTasks = page.requests.hold(AzureDevOpsNames.readWorkItemsMethod);
    const releasePull = page.requests.hold(AzureDevOpsNames.readPullRequestMethod);
    page.open(`${INSTANCE}/7521`);
    await page.requests.askedAsync(3);
    await Wait.until(() => expect(page.texts(".item")).toHaveLength(6));

    page.find(".item:nth-of-type(6)").click();
    await Wait.until(() => expect(page.find(".detail").getAttribute("aria-label")).toBe("Work item 7532"));
    releaseTasks(listOf(tasks));
    releasePull(pullRequest.toJson());
    await page.settleAsync();

    expect(page.texts(".section")).toEqual(["Development No branch, pull request or commit is linked yet."]);
  });

  it("logs a work item page the window can't open from the Work item view", async () => {
    const page = await new Page().answerMine().openAsync();
    page.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });

    await page.clickAsync(".open");
    await Wait.until(() => expect(page.logs).toHaveLength(1));

    expect(page.logs).toEqual([`The Azure DevOps module couldn't open ${urlOf(7402)}: WindowFailure: No browser.`]);
  });

  it("rethrows a failure to open the work item page that isn't the window's", async () => {
    const page = await new Page().answerMine().openAsync();
    page.context.answer("openLinkAsync", async () => {
      throw new RangeError("Unexpected.");
    });
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();

    await page.clickAsync(".open");

    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("says no commit read names the shown work item when the repository's history names none", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/garden-web")));
    const page = new Page().answerMine();
    page.requests.answer(GitNames.statusMethod, azureStatus.toJson());
    page.requests.answer(GitNames.graphMethod, new GitGraph([], false).toJson());
    page.requests.answer(GitNames.messageReferencesMethod, noMessages);
    await page.openAsync();

    await Wait.until(() => expect(page.texts(".history-empty")).toEqual(["No commit read names 7402."]));
  });

  it("can't open the branch dialog without an open repository", async () => {
    const page = await new Page().answerMine().openAsync();

    expect(page.find(".create").hasAttribute("disabled")).toBe(true);
  });

  it("opens the branch dialog for the shown work item in the open repository", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/garden-web")));
    const page = new Page().answerMine();
    page.requests.answer(GitNames.statusMethod, githubStatus.toJson());
    page.requests.hold(GitNames.statusMethod);
    page.requests.fail(GitNames.branchesMethod, new WindowFailure("Not connected."));
    page.requests.fail(AzureDevOpsNames.readSignInMethod, new WindowFailure("Not connected."));
    page.requests.fail(AzureDevOpsNames.readWorkItemMethod, new WindowFailure("Not connected."));
    page.open();
    await Wait.until(() => expect(page.find(".create").hasAttribute("disabled")).toBe(false));
    page.find(".create").click();

    await Wait.until(() => expect(document.querySelector("nol-dialog")?.textContent).toContain("7402"));
  });

  it("lists the open repository's commits among its last 1,000 that name the shown work item in the subject or AB#N in the message, newest first, saying the read stops there",
    async () => {
      onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/garden-web")));
      const page = new Page().answerMine();
      page.requests.answer(GitNames.statusMethod, azureStatus.toJson());
      page.requests.answer(GitNames.graphMethod, history.toJson());
      page.requests.answer(GitNames.messageReferencesMethod, messages.toJson());
      page.requests.answer(AzureDevOpsNames.readWorkItemsMethod, listOf(tasks));
      page.requests.answer(AzureDevOpsNames.readPullRequestMethod, pullRequest.toJson());
      await page.openAsync();
      const shown = (): readonly string[] => [...page.texts(".history-title"), ...page.texts(".history .commit"), ...page.texts(".history-empty"),
        ...page.texts(".history-cap")];

      const first: readonly string[] = shown();
      const note: readonly string[] = page.texts(".history-note");
      await page.chooseRowAsync(7532);
      const second: readonly string[] = shown();
      await page.chooseRowAsync(7521);

      expect([first, note, second, shown()]).toEqual([
        ["Linked in your history", "Read local times assignment AB#7531 and workspace_premium AB#7402 bbbbbbb · Mona Lisa · 2 h",
          "It covers the repository's last 1,000 commits."],
        ["Commits in this repository that name 7402: #7402 or AB#7402 in the subject, or AB#7402 in its message."],
        ["Linked in your history", "Fold the tag case in the note list filter assignment #7532 aaaaaaa · Mona Lisa · 12 min",
          "It covers the repository's last 1,000 commits."],
        ["Linked in your history", "Tidy x#7402 and ab#7402 ccccccc · Mona Lisa · 3 d", "It covers the repository's last 1,000 commits."]
      ]);
      expect(page.requests.payloads[page.requests.methods.indexOf(GitNames.graphMethod)]).toEqual(new GitGraphParams("/work/garden-web", 1000, 0).toJson());
      expect(page.requests.methods.filter(t => t === GitNames.graphMethod)).toHaveLength(1);
    });

  it("draws each work item a subject names as a chip, its type's icon in its colour, reading one the page hasn't, and dates a commit past 30 days",
    async () => {
      onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/garden-web")));
      const page = new Page().answerMine();
      page.requests.answer(GitNames.statusMethod, azureStatus.toJson());
      page.requests.answer(GitNames.graphMethod, new GitGraph([new GitGraphCommit(new GitCommit("d".repeat(40), [], "Mona Lisa", "2025-01-05T12:00:00Z",
        "Guard AB#7699 behind #7402"), "kim@fabrikam.com", [])], false).toJson());
      page.requests.answer(GitNames.messageReferencesMethod, noMessages);
      const release = page.requests.hold(AzureDevOpsNames.readWorkItemsMethod);
      await page.openAsync();
      const reading: readonly string[] = page.texts(".history .commit");

      release(listOf([new HostWorkItemDetail(itemOf(7699, bug, "Times drift past midnight", "Active", WorkItemCategory.InProgress, null), null, null, null, null,
        null, [], [], 0, [])]));
      await Wait.until(() => expect(page.texts(".history .chip.ref")).toEqual(["bug_report AB#7699", "workspace_premium #7402"]));
      const colours: readonly string[] = [...page.element.querySelectorAll<HTMLElement>(".history .chip-icon")].map(t => getComputedStyle(t).color);

      expect([reading, page.texts(".history .commit"), colours, page.requests.payloads[page.requests.methods.lastIndexOf(AzureDevOpsNames.readWorkItemsMethod)],
        page.requests.methods.filter(t => t === AzureDevOpsNames.readWorkItemsMethod).length]).toEqual([
        ["Guard description AB#7699 behind workspace_premium #7402 ddddddd · Mona Lisa · Jan 5"],
        ["Guard bug_report AB#7699 behind workspace_premium #7402 ddddddd · Mona Lisa · Jan 5"], ["rgb(204, 41, 61)", "rgb(255, 123, 0)"],
        new WorkItemsQuery(HOST, "fabrikam", PROJECT, WorkItemScope.Ids, [7699]).toJson(), 2]);
    });

  it("shows a commit in the Git module's history at a click, and logs a history the window can't open", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/garden-web")));
    const page = new Page().answerMine();
    page.requests.answer(GitNames.statusMethod, azureStatus.toJson());
    page.requests.answer(GitNames.graphMethod, history.toJson());
    page.requests.answer(GitNames.messageReferencesMethod, noMessages);
    let calls = 0;
    page.context.answer("runCommandAsync", async () => {
      calls++;
      if (calls === 2)
        throw new WindowFailure("No Git module.");
      return null;
    });
    await page.openAsync();

    await page.clickAsync(".history .commit");
    await page.clickAsync(".history .commit");
    await Wait.until(() => expect(page.logs).toHaveLength(1));

    expect([page.context.callsOf("runCommandAsync"), page.logs, page.find(".history .commit").getAttribute("aria-label")]).toEqual([
      [["git.openHistory", { folder: "/work/garden-web" }], ["git.openHistory", { folder: "/work/garden-web" }]],
      ["The Azure DevOps module's git.openHistory request failed: WindowFailure: No Git module."], "Show Read local times AB#7531 and AB#7402 in the history"]);
  });

  it("rethrows a failure to open the history that isn't the window's", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/garden-web")));
    const page = new Page().answerMine();
    page.requests.answer(GitNames.statusMethod, azureStatus.toJson());
    page.requests.answer(GitNames.graphMethod, history.toJson());
    page.requests.answer(GitNames.messageReferencesMethod, noMessages);
    page.context.answer("runCommandAsync", async () => {
      throw new RangeError("Unexpected.");
    });
    await page.openAsync();
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();

    await page.clickAsync(".history .commit");

    expect(await rejection).toBeInstanceOf(RangeError);
  });

  it("shows no history without an open repository", async () => {
    const page = await new Page().answerMine().openAsync();

    expect([page.element.querySelector(".history"), page.requests.methods]).toEqual([null, [AzureDevOpsNames.readWorkItemsMethod]]);
  });

  it("shows no history, reading none, for a repository not on Azure DevOps", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/site")));
    const page = new Page().answerMine();
    page.requests.answer(GitNames.statusMethod, githubStatus.toJson());
    await page.openAsync();

    expect([page.element.querySelector(".history"), page.requests.methods]).toEqual([null, [AzureDevOpsNames.readWorkItemsMethod, GitNames.statusMethod]]);
  });

  it("drops a history read for a repository that is no longer open when it comes", async () => {
    const folder = signal<string | null>("/work/garden-web");
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), folder));
    const page = new Page().answerMine().answerMine();
    page.requests.answer(GitNames.statusMethod, azureStatus.toJson(), githubStatus.toJson());
    const release = page.requests.hold(GitNames.graphMethod);
    page.requests.answer(GitNames.messageReferencesMethod, noMessages);
    page.open();
    await page.requests.askedAsync(3);

    folder.set("/work/site");
    await page.requests.askedAsync(5);
    release(history.toJson());
    await page.settleAsync();

    expect([page.element.querySelector(".history"), page.requests.methods]).toEqual([null, [AzureDevOpsNames.readWorkItemsMethod, GitNames.statusMethod,
      GitNames.graphMethod, AzureDevOpsNames.readWorkItemsMethod, GitNames.statusMethod, GitNames.messageReferencesMethod]]);
  });

  it("shows no history and logs it when the history read fails", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/garden-web")));
    const page = new Page().answerMine();
    page.requests.answer(GitNames.statusMethod, azureStatus.toJson());
    page.requests.fail(GitNames.graphMethod, new WindowFailure("Not a repository."));
    await page.openAsync();
    await Wait.until(() => expect(page.logs).toHaveLength(1));

    expect([page.element.querySelector(".history"), page.logs]).toEqual([null, ["The Azure DevOps module's git.graph request failed: WindowFailure: Not a repository."]]);
  });
});
