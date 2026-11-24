/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException } from "@noldova/desktop.window";
import { DeviceCode, HostAccount, HostChanges, HostItem, HostPerson, HostReference, HostSignIn, HostWorkItem, HostWorkItemType, ReferenceKind, ReferenceState,
  WorkItemCategory, WorkItemQuery } from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import type { LinkReference } from "@noldova/ui.components.angular";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AzureDevOpsReferenceSource } from "../../../src/app/services/azure-devops-reference-source.ts";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture.ts";
import { PartReadError } from "../../fixtures/part-read-error.fixture.ts";
import { ReferenceContext } from "../../fixtures/reference-context.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";

describe("AzureDevOpsReferenceSource", () => {
  const readMethod = "git-azure-devops.readWorkItem";
  const referenceMethod = "git-azure-devops.readReference";
  const signInEvent = "git-azure-devops.signInChanged";
  const signInMethod = "git-azure-devops.readSignIn";
  const statusMethod = "git.status";
  const repository = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
  const pullRequestUrl = `https://dev.azure.com/fabrikam/web/_git/${repository}/pullrequest/7`;
  const statusOf = (remote: GitRemote | null): JsonValue => new GitStatus("main", null, null, [], false, "f1", null, remote).toJson();
  const azureRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https);
  const statusReads = (): readonly JsonValue[] => context.requests.filter(t => t.method === statusMethod).map(t => t.parameters);
  const urlOf = (id: number, organization: string = "fabrikam"): string => `https://dev.azure.com/${organization}/web/_workitems/edit/${id}`;
  const itemOf = (id: number, title: string = "The greeting is cut short"): JsonValue =>
    new HostWorkItem("git-azure-devops", "fabrikam", "web", id, new HostWorkItemType("Bug", "CC293D", "icon_insect"), title, "Active", WorkItemCategory.InProgress,
      urlOf(id), null, null, null, null).toJson();
  const pullRequest = new HostItem(new HostReference("git-azure-devops", "fabrikam", repository, 7), ReferenceKind.PullRequest, ReferenceState.Open, "Fix the greeting",
    "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/7", new HostPerson("octocat@example.com", null, null), Date.parse("2026-11-01T09:30:00.000Z"), null, 0,
    new HostChanges(null, null, null, "feature/greeting", "main", "0123456789abcdef0123456789abcdef01234567")).toJson();
  const idOf = (parameters: JsonValue): number => WorkItemQuery.fromJson(parameters).id;
  const signedIn = HostSignIn.signedIn(new HostAccount("monalisa@example.com", "Mona Lisa", null, [])).toJson();
  const signedOut = HostSignIn.signedOut().toJson();
  const waiting = HostSignIn.waiting(new DeviceCode("WDJB-MJHT", "https://example.com/device", Date.parse("2026-11-07T10:00:00.000Z"))).toJson();
  let context: ReferenceContext;
  let source: AzureDevOpsReferenceSource;
  let held: Map<number, DeferredResponse>;

  const shown = (item: Signal<LinkReference | null>): readonly (string | null)[] | null => {
    const value = item();
    return Object.isNull(value) ? null : [value.reference, value.state?.label ?? null, value.title];
  };
  const reads = (): readonly number[] => context.requests.filter(t => t.method === readMethod).map(t => idOf(t.parameters));
  const find = (url: string): Signal<LinkReference | null> => {
    const item = source.find(url);
    if (Object.isNull(item))
      throw new PartReadError(`${url} isn't an Azure DevOps item.`);
    return item;
  };
  const start = (made: ReferenceContext): void => {
    context = made;
    source = AzureDevOpsReferenceSource.register(made);
  };

  beforeEach(() => {
    held = new Map();
    start(new ReferenceContext().answerModule(readMethod, t => {
      const response = new DeferredResponse();
      held.set(idOf(t), response);
      return response.promise;
    }).answerModule(signInMethod, () => signedIn));
    context.emitModule(signInEvent, signedIn);
  });

  afterEach(() => {
    AzureDevOpsReferenceSource.release(context);
  });

  it("shows a work item as its id with no state while Azure DevOps reads it, then as the item, asking by the organization and id", async () => {
    const item = find(urlOf(1));

    expect(shown(item)).toEqual(["Work item 1", null, null]);
    await Wait.until(() => expect(reads()).toEqual([1]));
    expect(context.requests.find(t => t.method === readMethod)?.parameters).toEqual({ host: "git-azure-devops", organization: "fabrikam", id: 1 });

    held.get(1)?.resolve(itemOf(1));

    await Wait.until(() => expect(shown(item)).toEqual(["Bug 1", "Bug", "The greeting is cut short"]));
  });

  it("reads a pull request whose link names its repository's id by its reference, and shows it, or a plain link when Azure DevOps has none", async () => {
    const answers = [pullRequest, null];
    context.answerModule(referenceMethod, () => answers.shift() ?? null);

    const item = find(pullRequestUrl);
    await Wait.until(() => expect(shown(item)).toEqual(["!7", "Active", "Fix the greeting"]));
    const gone = find(`https://dev.azure.com/fabrikam/web/_git/${repository}/pullrequest/8`);

    await Wait.until(() => expect(context.requests.filter(t => t.method === referenceMethod)).toHaveLength(2));
    await Wait.until(() => expect(gone()).toBeNull());
    expect(context.requests.find(t => t.method === referenceMethod)?.parameters).toEqual({ host: "git-azure-devops", owner: "fabrikam", repository, number: 7 });
  });

  it("knows no link but an Azure DevOps work item's or a pull request's by repository id, and asks Azure DevOps nothing about the others", () => {
    expect(["https://example.com/fabrikam/web/_workitems/edit/1", "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/7", "https://dev.azure.com/fabrikam/web",
      "chat://c1", "docs/readme.md"].map(t => source.find(t))).toEqual([null, null, null, null, null]);
    expect(context.methods).toEqual([signInMethod]);
  });

  it("turns the reference into a plain link when no one is signed in to Azure DevOps or the item isn't there, and asks no one to sign in", async () => {
    const item = find(urlOf(1));
    await Wait.until(() => expect(reads()).toEqual([1]));

    held.get(1)?.resolve(null);

    await Wait.until(() => expect(item()).toBeNull());
    expect(context.methods).toEqual([signInMethod, readMethod]);
    expect(context.lines).toEqual([]);
  });

  it("turns the reference into a plain link when the read fails, the runtime is gone, the answer doesn't parse or the module doesn't answer, and logs each once", async () => {
    context.answerModule(readMethod, t => {
      const id = idOf(t);
      if (id === 1)
        throw new Error("Azure DevOps answered 502.");
      if (id === 2)
        throw new RuntimeRequestException(FailureCode.Disconnected, "The runtime is gone.");
      if (id === 3)
        return { title: "No more than a title" };
      return id === 4 ? Promise.reject(new Error("The Azure DevOps module isn't running.")) : Promise.reject("The Azure DevOps module stopped.");
    });

    const items = [1, 2, 3, 4, 5].map(t => find(urlOf(t)));

    await Wait.until(() => expect(items.map(t => t())).toEqual([null, null, null, null, null]));
    expect(context.lines.map(t => /^Reading an Azure DevOps reference failed, so it shows as a plain link: \w+$/.test(t))).toEqual([true, true, true, true, true]);
    expect(context.lines.filter(t => t.endsWith(": string"))).toHaveLength(1);
    expect(context.lines.join(" ")).not.toMatch(/fabrikam|502|isn't running|stopped/);
  });

  it("reads a work item once for every link that names it, on either host, with or without its project, in any case", async () => {
    const first = find(urlOf(5));
    const again = [find("https://dev.azure.com/Fabrikam/_workitems/edit/5/"), find("https://fabrikam.visualstudio.com/web/_workitems/edit/5"), find(`${urlOf(5)}#c1`)];

    await Wait.until(() => expect(reads()).toEqual([5]));
    expect(again.map(t => t === first)).toEqual([true, true, true]);
  });

  it("finds no #N or AB#N in a message without the repository's organization", () => {
    expect([source.findText("Fixes AB#5 and #6."), source.readerFor(null) === source]).toEqual([[], true]);
  });

  it("reads a folder's Azure DevOps organization once, and finds #N and AB#N as its work items through the organization's reader", async () => {
    context.answerModule(statusMethod, () => statusOf(azureRemote));
    const home = source.homeOf("/work/site");
    const before = home();
    await Wait.until(() => expect(home()).toBe("fabrikam"));
    const reader = source.readerFor(home());

    expect([before, source.homeOf("/work/site") === home, source.readerFor("fabrikam") === reader]).toEqual([null, true, true]);
    expect(reader.findText?.("Fixes AB#12, see #5.").map(t => t.url)).toEqual([urlOf(12).replace("/web", ""), urlOf(5).replace("/web", "")]);
    expect(reader.find(urlOf(5), "#5") === find(urlOf(5))).toBe(true);
    expect(statusReads()).toEqual([{ folder: "/work/site" }]);
  });

  it("knows no organization for no folder, a folder Git can't read, or a remote that isn't Azure DevOps', so #N stays text", async () => {
    context.answerModule(statusMethod, t => {
      const folder = GitFolderParams.fromJson(t).folder;
      if (folder === "/work/gone")
        return Promise.reject(new Error("The Git module isn't running."));
      if (folder === "/work/plain")
        return statusOf(null);
      if (folder === "/work/broken")
        return { branch: 1 };
      return statusOf(folder === "/work/github" ? new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https) : azureRemote);
    });
    const homes = [null, "relative/site", "/work/gone", "/work/plain", "/work/broken", "/work/github", "/work/site"].map(t => source.homeOf(t));

    await Wait.until(() => expect(homes.at(-1)?.()).toBe("fabrikam"));
    expect([homes.map(t => t()), statusReads().length]).toEqual([[null, null, null, null, null, null, "fabrikam"], 5]);
  });

  it("forgets every folder's organization while Git is off and reads each again when it is back", async () => {
    let path = "fabrikam/web/_git/site";
    context.answerModule(statusMethod, () => statusOf(new GitRemote("origin", "dev.azure.com", path, RemoteTransport.Https)));
    const home = source.homeOf("/work/site");
    await Wait.until(() => expect(home()).toBe("fabrikam"));

    context.changeDependency("git", false);
    const off = home();
    path = "contoso/web/_git/site";
    context.changeDependency("git", true);

    await Wait.until(() => expect(home()).toBe("contoso"));
    expect([off, statusReads().length]).toEqual([null, 2]);
  });

  it("keeps a folder's organization unknown when Git goes off while its read is unanswered, and a later read still lands", async () => {
    const answers: DeferredResponse[] = [];
    context.answerModule(statusMethod, () => {
      const answer = new DeferredResponse();
      answers.push(answer);
      return answer.promise;
    });
    const home = source.homeOf("/work/site");
    context.changeDependency("git", false);
    const later = source.homeOf("/work/later");

    answers[0]?.resolve(statusOf(azureRemote));
    answers[1]?.resolve(statusOf(new GitRemote("origin", "ssh.dev.azure.com", "v3/contoso/web/site", RemoteTransport.Ssh)));

    await Wait.until(() => expect(later()).toBe("contoso"));
    expect(home()).toBeNull();
  });

  it("reads every remembered item again when the person signs in, keeping a shown item while it reads and showing a plain one as read", async () => {
    const plain = find(urlOf(1));
    const filled = find(urlOf(2));
    await Wait.until(() => expect(reads()).toEqual([1, 2]));
    held.get(1)?.resolve(null);
    held.get(2)?.resolve(itemOf(2));
    await Wait.until(() => expect([shown(plain), shown(filled)]).toEqual([null, ["Bug 2", "Bug", "The greeting is cut short"]]));

    context.emitModule(signInEvent, signedIn);

    expect([shown(plain), shown(filled)]).toEqual([["Work item 1", null, null], ["Bug 2", "Bug", "The greeting is cut short"]]);
    await Wait.until(() => expect(reads()).toEqual([1, 2, 1, 2]));
    held.get(1)?.resolve(itemOf(1, "Add a README"));
    held.get(2)?.resolve(itemOf(2, "Fix the greeting again"));
    await Wait.until(() => expect([shown(plain), shown(filled)]).toEqual([["Bug 1", "Bug", "Add a README"], ["Bug 2", "Bug", "Fix the greeting again"]]));
  });

  it("shows every chip as its type and number alone when the person signs out, and drops the reads under way, answered or failed, without a log", async () => {
    const items = [1, 2, 3, 4].map(t => find(urlOf(t)));
    const waitingRead = find(urlOf(5));
    await Wait.until(() => expect(reads()).toEqual([1, 2, 3, 4]));

    context.emitModule(signInEvent, signedOut);

    expect([...items, waitingRead].map(t => t()?.reference)).toEqual(["Work item 1", "Work item 2", "Work item 3", "Work item 4", "Work item 5"]);
    const later = [6, 7].map(t => find(urlOf(t)));
    held.get(1)?.resolve(itemOf(1));
    held.get(2)?.reject(new Error("Azure DevOps answered 401."));
    expect([[...items, ...later].map(shown), reads()]).toEqual([[1, 2, 3, 4, 6, 7].map(t => [`Work item ${String(t)}`, null, null]), [1, 2, 3, 4]]);

    context.emitModule(signInEvent, signedIn);

    await Wait.until(() => expect(reads()).toEqual([1, 2, 3, 4, 1, 2]));
    expect(context.lines).toEqual([]);
  });

  it("changes nothing for a sign-in that waits", async () => {
    const item = find(urlOf(1));
    await Wait.until(() => expect(reads()).toEqual([1]));
    held.get(1)?.resolve(itemOf(1));
    await Wait.until(() => expect(shown(item)?.[1]).toBe("Bug"));

    context.emitModule(signInEvent, waiting);

    expect([shown(item), reads()]).toEqual([["Bug 1", "Bug", "The greeting is cut short"], [1]]);
  });

  it("shows every chip as its type and number alone when the Azure DevOps module stops, reads them again when it starts, and ignores other modules", async () => {
    const item = find(urlOf(1));
    await Wait.until(() => expect(reads()).toEqual([1]));
    held.get(1)?.resolve(itemOf(1));
    await Wait.until(() => expect(shown(item)?.[1]).toBe("Bug"));

    context.changeDependency("git-github", false);
    const kept = shown(item);
    context.changeDependency("git-azure-devops", false);
    const stopped = shown(item);
    context.changeDependency("git-azure-devops", true);

    expect([kept, stopped]).toEqual([["Bug 1", "Bug", "The greeting is cut short"], ["Work item 1", null, null]]);
    await Wait.until(() => expect([shown(item), reads(), context.methods.filter(t => t === signInMethod)]).toEqual([["Work item 1", null, null], [1, 1],
      [signInMethod, signInMethod]]));
    held.get(1)?.resolve(itemOf(1));
    await Wait.until(() => expect(shown(item)?.[1]).toBe("Bug"));
  });

  it("reads the sign-in when it starts, and while no one is signed in shows every Azure DevOps link as a bare chip and asks Azure DevOps nothing about it", async () => {
    AzureDevOpsReferenceSource.release(context);
    const signIn = new DeferredResponse();
    start(new ReferenceContext().answerModule(readMethod, () => itemOf(1)).answerModule(signInMethod, () => signIn.promise));
    const before = find(urlOf(1));

    signIn.resolve(signedOut);
    await signIn.promise;
    const after = find(urlOf(2));

    expect([shown(before), shown(after), context.methods]).toEqual([["Work item 1", null, null], ["Work item 2", null, null], [signInMethod]]);
    context.emitModule(signInEvent, signedIn);
    await Wait.until(() => expect([shown(before)?.[1], shown(after)?.[1]]).toEqual(["Bug", "Bug"]));
  });

  it("treats a failed or unreadable sign-in as signed out, and reads items once the module starts again and says someone is signed in", async () => {
    for (const failed of [(): Promise<JsonValue> => Promise.reject(new Error("The Azure DevOps module isn't running.")), (): JsonValue => ({ state: 7 })]) {
      AzureDevOpsReferenceSource.release(context);
      const answers = [failed, (): JsonValue => signedIn];
      start(new ReferenceContext().answerModule(readMethod, () => itemOf(1)).answerModule(signInMethod, () => (answers.shift() ?? failed)()));
      const item = find(urlOf(1));

      context.changeDependency("git-azure-devops", true);

      expect([shown(item), reads()]).toEqual([["Work item 1", null, null], []]);
      await Wait.until(() => expect(shown(item)?.[1]).toBe("Bug"));
      expect([context.methods.filter(t => t === signInMethod).length, reads(), context.lines]).toEqual([2, [1], []]);
    }
  });

  it("reads at most four items at a time and starts the next as each read ends", async () => {
    const items = [1, 2, 3, 4, 5, 6].map(t => find(urlOf(t)));

    await Wait.until(() => expect(reads()).toEqual([1, 2, 3, 4]));
    expect(items.map(t => shown(t)?.[0])).toEqual([1, 2, 3, 4, 5, 6].map(t => `Work item ${t}`));
    held.get(2)?.resolve(null);
    await Wait.until(() => expect(reads()).toEqual([1, 2, 3, 4, 5]));
    held.get(1)?.resolve(itemOf(1));
    await Wait.until(() => expect(reads()).toEqual([1, 2, 3, 4, 5, 6]));
  });

  it("finds a pull request's remembered page address as the pull request its id names, and forgets the page remembered longest ago past 500", () => {
    const repository = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    const pageOf = (number: number): string => `https://dev.azure.com/fabrikam/web/_git/site/pullrequest/${String(number)}`;
    const remember = (number: number): void => source.rememberPage(pageOf(number), new HostReference("git-azure-devops", "fabrikam", repository, number));
    const before = source.find(pageOf(1));
    for (let number = 1; number <= 500; number++)
      remember(number);
    remember(1);
    remember(501);

    expect([before, source.find(pageOf(1)) === source.find(`https://dev.azure.com/fabrikam/web/_git/${repository}/pullrequest/1`), source.find(pageOf(2)),
      source.find(pageOf(501))?.()?.reference]).toEqual([null, true, null, "!501"]);
  });

  it("remembers the 500 items named last, so an item named again stays, and the one named longest ago is read again", async () => {
    context.answerModule(readMethod, () => null);
    const first = find(urlOf(1));
    for (let id = 2; id <= 500; id++)
      find(urlOf(id));
    await Wait.until(() => expect(reads()).toHaveLength(500));

    const kept = find(urlOf(1));
    find(urlOf(501));
    await Wait.until(() => expect(reads()).toHaveLength(501));
    const keptAgain = find(urlOf(1));
    find(urlOf(2));

    await Wait.until(() => expect(reads()).toHaveLength(502));
    expect([kept === first, keptAgain === first, reads().at(-1)]).toEqual([true, true, 2]);
  });

  it("gives a context the source it registered, following Azure DevOps once, until it's released, and a new source after", () => {
    const again = AzureDevOpsReferenceSource.register(context);
    const heard = [...context.heardEvents];
    AzureDevOpsReferenceSource.release(context);
    const next = AzureDevOpsReferenceSource.register(context);

    expect([again === source, heard, next === source, context.heardEvents]).toEqual([true, [signInEvent], false, [signInEvent]]);
  });

  it("stops following Azure DevOps and shows its chips as their type and number when released, and releases a context it doesn't know without failing", async () => {
    const item = find(urlOf(1));
    await Wait.until(() => expect(reads()).toEqual([1]));
    expect([context.heardEvents, context.dependencyListeners]).toEqual([[signInEvent], 1]);

    AzureDevOpsReferenceSource.release(context);
    AzureDevOpsReferenceSource.release(new ReferenceContext());

    expect([shown(item), context.heardEvents, context.dependencyListeners]).toEqual([["Work item 1", null, null], [], 0]);
  });
});
