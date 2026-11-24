/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException, WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostPerson, HostReference, HostReviewer } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { AzureDevOpsAddReviewerComponent } from "../../../../src/app/components/azure-devops-add-reviewer/azure-devops-add-reviewer.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "3f2504e0-4f89-11d3-9a0c-0305e82c3301", 752);
const mona = { descriptor: "aad.TW9uYQ", name: "Mona Lisa", login: "monalisa@fabrikam.com", isGroup: false };
const octocat = { descriptor: "aad.T2N0bw", name: "Octocat", login: "Octocat@fabrikam.com", isGroup: false };
const team = { descriptor: "vssgp.V2Vi", name: "Web Team", login: "[Web Site]\\Web Team", isGroup: true };
const added: HostReviewer = new HostReviewer(new HostPerson("monalisa@fabrikam.com", null, null), 0, "No vote", false);

function wordsOf(node: Node): string {
  const words: string[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text !== null; text = walker.nextNode())
    words.push((text.textContent ?? "").trim());
  return words.filter(t => t.length > 0).join(" ").replace(/\s+/g, " ");
}

class Search {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context).ignore(AzureDevOpsNames.readPersonAvatarMethod);
  public readonly added: HostReviewer[] = [];
  public closed: number = 0;
  public fixture: ComponentFixture<AzureDevOpsAddReviewerComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The search isn't open.");
    return element;
  }

  public get field(): HTMLInputElement {
    const found = this.element.querySelector("input");
    if (!(found instanceof HTMLInputElement))
      throw new Error("No search field is shown.");
    return found;
  }

  public async openAsync(reviewers: readonly string[] = []): Promise<this> {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    this.fixture = TestBed.createComponent(AzureDevOpsAddReviewerComponent);
    this.fixture.componentRef.setInput("reference", reference);
    this.fixture.componentRef.setInput("reviewers", reviewers);
    this.fixture.componentInstance.added.subscribe(t => this.added.push(t));
    this.fixture.componentInstance.closed.subscribe(() => this.closed++);
    this.fixture.autoDetectChanges();
    await this.settleAsync();
    return this;
  }

  public type(text: string): void {
    this.field.value = text;
    this.field.dispatchEvent(new Event("input"));
  }

  public async typeAsync(text: string): Promise<void> {
    this.type(text);
    await this.settleAsync();
  }

  public untilAsync(done: () => boolean): Promise<void> {
    if (done())
      return Promise.resolve();
    return new Promise(resolve => {
      const observer: MutationObserver = new MutationObserver(() => {
        if (!done())
          return;
        observer.disconnect();
        resolve();
      });
      observer.observe(document.body, { attributes: true, characterData: true, childList: true, subtree: true });
    });
  }

  public async settleAsync(): Promise<void> {
    await this.fixture?.whenStable();
    this.fixture?.detectChanges();
    await this.fixture?.whenStable();
  }

  public texts(selector: string): string[] {
    return [...this.element.querySelectorAll(selector)].map(wordsOf);
  }

  public people(): HTMLButtonElement[] {
    return [...this.element.querySelectorAll(".person")].filter(t => t instanceof HTMLButtonElement);
  }
}

describe("AzureDevOpsAddReviewerComponent", () => {
  it("focuses its field and searches from the third character, listing each person or group found, a group marked as one, but those already reviewers", async () => {
    const search = await new Search().openAsync(["octocat@fabrikam.com"]);
    search.requests.answer(AzureDevOpsNames.searchPeopleMethod, [mona, octocat, team]);
    const focused: boolean = document.activeElement === search.field;

    await search.typeAsync(" mo ");
    const asked: number = search.requests.methods.length;
    await search.typeAsync(" mon ");

    expect([focused, asked, search.requests.methods, search.requests.payloads]).toEqual([true, 0, [AzureDevOpsNames.searchPeopleMethod],
      [{ reference: reference.toJson(), query: "mon" }]]);
    expect(search.texts(".person")).toEqual(["M Mona Lisa monalisa@fabrikam.com", "W Web Team groups Group [Web Site]\\Web Team"]);
  });

  it("says when no one matches, and shows nothing again below three characters", async () => {
    const search = await new Search().openAsync(["monalisa@fabrikam.com"]);
    search.requests.answer(AzureDevOpsNames.searchPeopleMethod, [mona], []);

    await search.typeAsync("mona");
    const hidden: string[] = search.texts(".found");
    await search.typeAsync("monal");
    const none: string[] = search.texts(".found");
    await search.typeAsync("mo");

    expect([hidden, none, search.element.querySelector(".found")]).toEqual([["No one matches."], ["No one matches."], null]);
  });

  it("shows only the answer for the latest text", async () => {
    const search = await new Search().openAsync();
    const first = search.requests.hold(AzureDevOpsNames.searchPeopleMethod);
    const failing = search.requests.holdFailure(AzureDevOpsNames.searchPeopleMethod);
    search.requests.answer(AzureDevOpsNames.searchPeopleMethod, [team]);

    search.type("mon");
    search.type("mona");
    search.type("web");
    await search.untilAsync(() => search.people().length === 1);
    first([mona]);
    failing(new WindowFailure("The runtime stopped."));
    await search.settleAsync();

    expect([search.texts(".person"), search.element.querySelector("[role=alert]")]).toEqual([["W Web Team groups Group [Web Site]\\Web Team"], null]);
  });

  it("shows the runtime's sentence or that Azure DevOps didn't answer the search, logs each, and clears it on the next text", async () => {
    const search = await new Search().openAsync();
    search.requests.fail(AzureDevOpsNames.searchPeopleMethod, new RuntimeRequestException(FailureCode.Unauthorized, "Sign in to Azure DevOps first."));
    search.requests.fail(AzureDevOpsNames.searchPeopleMethod, new WindowFailure("The runtime stopped."));

    await search.typeAsync("mon");
    const refused: string[] = search.texts("[role=alert]");
    await search.typeAsync("mona");
    const unanswered: string[] = search.texts("[role=alert]");
    await search.typeAsync("mo");

    expect([refused, unanswered, search.element.querySelector("[role=alert]")]).toEqual([["error Sign in to Azure DevOps first."],
      ["error Azure DevOps didn't answer. Type again to search."], null]);
    expect(search.context.callsOf("log").map(t => String(t[0]).includes("git-azure-devops.searchPeople"))).toEqual([true, true]);
  });

  it("adds the person only on a click on their row, holding the field and rows while it runs, and passes the reviewer on", async () => {
    const search = await new Search().openAsync();
    search.requests.answer(AzureDevOpsNames.searchPeopleMethod, [mona, team]);
    const release = search.requests.hold(AzureDevOpsNames.addReviewerMethod);
    await search.typeAsync("mon");

    search.people()[0]?.click();
    await search.untilAsync(() => search.field.disabled);
    const held: boolean[] = [search.field.disabled, ...search.people().map(t => t.disabled)];
    release(added.toJson());
    await search.untilAsync(() => !search.field.disabled);

    expect([held, search.added, search.requests.payloads.at(-1)]).toEqual([[true, true, true], [added],
      { reference: reference.toJson(), descriptor: "aad.TW9uYQ" }]);
  });

  it("shows the runtime's sentence or that Azure DevOps didn't answer the addition, logs each, adds nothing and keeps the rows", async () => {
    const search = await new Search().openAsync();
    search.requests.answer(AzureDevOpsNames.searchPeopleMethod, [mona]);
    const cannot = "The Azure DevOps token can't add reviewers; it needs the Code (Read & write) scope.";
    search.requests.fail(AzureDevOpsNames.addReviewerMethod, new RuntimeRequestException(FailureCode.Unauthorized, cannot));
    search.requests.fail(AzureDevOpsNames.addReviewerMethod, new WindowFailure("The runtime stopped."));
    await search.typeAsync("mon");

    search.people()[0]?.click();
    await search.untilAsync(() => search.element.querySelector("[role=alert]") !== null);
    const refused: string[] = search.texts("[role=alert]");
    search.people()[0]?.click();
    await search.untilAsync(() => search.texts("[role=alert]")[0] !== refused[0]);

    expect([refused, search.texts("[role=alert]"), search.added, search.people().length]).toEqual([[`error ${cannot}`],
      ["error Azure DevOps didn't answer, so nothing changed. Try again."], [], 1]);
    expect(search.context.callsOf("log").map(t => String(t[0]).includes("git-azure-devops.addReviewer"))).toEqual([true, true]);
  });

  it("drops an addition's answer or failure once the person closed the search, and closes on Escape", async () => {
    const search = await new Search().openAsync();
    search.requests.answer(AzureDevOpsNames.searchPeopleMethod, [mona]);
    const release = search.requests.hold(AzureDevOpsNames.addReviewerMethod);
    const failing = search.requests.holdFailure(AzureDevOpsNames.addReviewerMethod);
    await search.typeAsync("mon");

    search.people()[0]?.click();
    search.people()[0]?.click();
    search.field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    release(added.toJson());
    failing(new WindowFailure("The runtime stopped."));
    await search.settleAsync();

    expect([search.closed, search.added, search.element.querySelector("[role=alert]"), search.field.disabled]).toEqual([1, [], null, true]);
  });

  it("rethrows a search's or an addition's failure that isn't the window's", async () => {
    const search = await new Search().openAsync();
    search.requests.fail(AzureDevOpsNames.searchPeopleMethod, new RangeError("Unexpected search."));
    search.requests.answer(AzureDevOpsNames.searchPeopleMethod, [mona]);
    search.requests.fail(AzureDevOpsNames.addReviewerMethod, new RangeError("Unexpected addition."));

    const searched: Promise<unknown> = UnhandledRejections.nextAsync();
    await search.typeAsync("mon");
    const thrown: unknown = await searched;
    await search.typeAsync("mona");
    const adding: Promise<unknown> = UnhandledRejections.nextAsync();
    search.people()[0]?.click();

    expect([thrown, await adding]).toEqual([new RangeError("Unexpected search."), new RangeError("Unexpected addition.")]);
    expect(search.context.callsOf("log")).toEqual([]);
  });
});
