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
import { HostComment, HostPerson, HostPullRequestThreads, HostReference, HostThread, ThreadStatus } from "@noldova/git.hosting.protocol";
import type { LinkOpenEvent } from "@noldova/ui.components.angular";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { describe, expect, it } from "vitest";

import { GitPullRequestThreadsComponent } from "../../../../src/app/components/git-pull-request-threads/git-pull-request-threads.component.ts";
import { ThreadLine } from "../../../../src/app/models/thread-line.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { TestPullRequestHost } from "../../../fixtures/test-pull-request-host.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const PUBLISHED: number = Date.UTC(2026, 10, 20, 12);
const UNANSWERED: string = "Example didn't answer. Try again to read the comments.";
const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 482);
const other: HostReference = new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 7);
const monalisa: HostPerson = new HostPerson("monalisa@fabrikam.com", null, null);
const octocat: HostPerson = new HostPerson("octocat@fabrikam.com", null, null);
const onLine: HostThread = new HostThread(1, ThreadStatus.Active, "/src/notes-export.ts", 42, [
  new HostComment(1, null, octocat, PUBLISHED, "Should this respect **local times**?"),
  new HostComment(2, 1, monalisa, PUBLISHED + 60_000, "Yes, it will.")
]);
const resolved: HostThread = new HostThread(2, ThreadStatus.Resolved, "/README.md", null, [
  new HostComment(1, null, octocat, PUBLISHED, "Typo in the heading."),
  new HostComment(2, 1, monalisa, PUBLISHED, "Fixed.")
]);
const general: HostThread = new HostThread(3, ThreadStatus.None, null, null, [new HostComment(1, null, monalisa, PUBLISHED, "Ready once CI passes.")]);
const pending: HostThread = new HostThread(4, ThreadStatus.Pending, null, null, [new HostComment(1, null, octocat, PUBLISHED, "Waiting on design.")]);

function wordsOf(node: Node): string {
  const words: string[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text !== null; text = walker.nextNode())
    words.push((text.textContent ?? "").trim());
  return words.filter(t => t.length > 0).join(" ").replace(/\s+/g, " ");
}

class Threads {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public readonly host: TestPullRequestHost = new TestPullRequestHost();
  public readonly opened: LinkOpenEvent[] = [];
  public readonly lines: ThreadLine[] = [];
  public fixture: ComponentFixture<GitPullRequestThreadsComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The threads aren't open.");
    return element;
  }

  public get text(): string {
    return wordsOf(this.element);
  }

  public answer(...threads: readonly HostThread[]): this {
    this.requests.answer(TestPullRequestHost.threadsMethod, new HostPullRequestThreads(threads, false).toJson());
    return this;
  }

  public async openAsync(): Promise<this> {
    this.create();
    await this.settleAsync();
    return this;
  }

  public create(): void {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }, provideMarkdown()] });
    this.fixture = TestBed.createComponent(GitPullRequestThreadsComponent);
    this.fixture.componentRef.setInput("host", this.host);
    this.fixture.componentRef.setInput("reference", reference);
    this.fixture.componentInstance.linkOpen.subscribe(t => this.opened.push(t));
    this.fixture.componentInstance.goToLine.subscribe(t => this.lines.push(t));
    this.fixture.autoDetectChanges();
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

  public button(selector: string): HTMLButtonElement {
    const found = this.element.querySelector(selector);
    if (!(found instanceof HTMLButtonElement))
      throw new Error(`No button matches ${selector}.`);
    return found;
  }

  public draft(): HTMLTextAreaElement {
    const found = this.element.querySelector("textarea");
    if (!(found instanceof HTMLTextAreaElement))
      throw new Error("No draft is shown.");
    return found;
  }

  public async typeAsync(text: string): Promise<void> {
    if (this.element.querySelector("textarea") === null) {
      this.button(".start-reply").click();
      await this.settleAsync();
    }
    const draft = this.draft();
    draft.value = text;
    draft.dispatchEvent(new Event("input"));
    await this.settleAsync();
  }

  public find(selector: string): HTMLElement {
    const found = this.element.querySelector(selector);
    if (!(found instanceof HTMLElement))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  }
}

describe("GitPullRequestThreadsComponent", () => {
  it("reads the pull request's threads and shows each one's file, line, state and comments, counting the open ones", async () => {
    const threads = await new Threads().answer(onLine, general, pending).openAsync();
    await threads.untilAsync(() => threads.element.querySelector(".comment strong") !== null);

    const date = (time: number): string => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      .format(time);
    expect([threads.requests.methods, threads.requests.payloads]).toEqual([[TestPullRequestHost.threadsMethod], [reference.toJson()]]);
    expect(threads.texts(".threads-head")).toEqual(["Comments 2 open threads"]);
    expect(threads.texts(".thread-head")).toEqual(["forum Active comment on notes-export.ts, line 42 Go to line", "forum Pending comment"]);
    expect(threads.texts(".comment")).toEqual([`O octocat@fabrikam.com ${date(PUBLISHED)} Should this respect local times ?`,
      `M monalisa@fabrikam.com ${date(PUBLISHED + 60_000)} Yes, it will.`, `M monalisa@fabrikam.com ${date(PUBLISHED)} Ready once CI passes.`,
      `O octocat@fabrikam.com ${date(PUBLISHED)} Waiting on design.`]);
    expect([...threads.element.querySelectorAll(".comment")].map(t => t.classList.contains("reply"))).toEqual([false, true, false, false]);
    expect([...threads.element.querySelectorAll(".thread-state")].map(t => t.classList.contains("open"))).toEqual([true, true]);
  });

  it("folds a finished thread to its first comment until it is opened, and counts one open thread", async () => {
    const threads = await new Threads().answer(onLine, resolved).openAsync();
    const folded: string[] = threads.texts(".fold");

    threads.find(".fold").click();
    await threads.settleAsync();

    expect([threads.texts(".threads-head"), threads.texts(".thread-head")]).toEqual([["Comments 1 open thread"], ["forum Active comment on notes-export.ts, line 42 Go to line",
      "forum Resolved comment on README.md"]]);
    expect(folded).toEqual(["unfold_more octocat@fabrikam.com Typo in the heading. 2 comments"]);
    expect([threads.element.querySelector(".fold"), threads.texts(".comment").length]).toEqual([null, 4]);
  });

  it("names each state and folds the finished ones, and a single comment as one", async () => {
    const states = [ThreadStatus.WontFix, ThreadStatus.ByDesign, ThreadStatus.Closed];
    const note = new HostComment(1, null, monalisa, PUBLISHED, "Noted.");
    const threads = await new Threads().answer(...states.map((t, i) => new HostThread(i + 1, t, null, null, [note]))).openAsync();

    expect([threads.texts(".thread-state"), threads.texts(".fold .small"), threads.texts(".threads-head")]).toEqual([
      ["Won't fix", "By design", "Closed"], ["1 comment", "1 comment", "1 comment"], ["Comments 0 open threads"]]);
  });

  it("heads a thread without a state with the file's name and line alone, its full path as the head's tooltip", async () => {
    const threads = await new Threads().answer(new HostThread(5, ThreadStatus.None, "/src/app/list/NoteCard.ts", 42,
      [new HostComment(1, null, octocat, PUBLISHED, "Is this the card?")])).openAsync();

    expect([threads.texts(".thread-head"), threads.find(".place").title, threads.element.querySelector(".thread-state")]).toEqual([
      ["forum Comment on NoteCard.ts, line 42 Go to line"], "/src/app/list/NoteCard.ts", null]);
  });

  it("says when the pull request has no comments", async () => {
    const threads = await new Threads().answer().openAsync();

    expect(threads.text).toBe("Comments No comments yet.");
  });

  it("says it is reading until the answer comes", async () => {
    const threads = new Threads();
    const release = threads.requests.hold(TestPullRequestHost.threadsMethod);
    threads.create();
    await threads.requests.askedAsync(1);
    await threads.untilAsync(() => threads.text === "Comments Reading the comments on Example.");

    release(new HostPullRequestThreads([general], false).toJson());
    await threads.settleAsync();

    expect([threads.element.querySelector("[role=status]"), threads.texts(".comment").length]).toEqual([null, 1]);
  });

  it("shows the runtime's message or says the host didn't answer, logs each naming the host, and shows the threads the retry reads", async () => {
    const threads = new Threads();
    threads.requests.fail(TestPullRequestHost.threadsMethod, new RuntimeRequestException(FailureCode.Unavailable, "The organization isn't reachable."));
    threads.requests.fail(TestPullRequestHost.threadsMethod, new WindowFailure("The runtime stopped."));
    threads.answer(general);
    await threads.openAsync();
    const runtime: string = threads.text;

    threads.find(".threads-notice button").click();
    await threads.settleAsync();
    const window: string = threads.text;
    threads.find(".threads-notice button").click();
    await threads.settleAsync();

    expect([runtime, window]).toEqual([`Comments error The organization isn't reachable. Try again`, `Comments error ${UNANSWERED} Try again`]);
    const failed: string = "The Example module's git-example.readPullRequestThreads request failed";
    expect(threads.context.callsOf("log").map(t => String(t[0]).startsWith(failed))).toEqual([true, true]);
    expect([threads.element.querySelector("[role=alert]"), threads.texts(".comment").length]).toEqual([null, 1]);
  });

  it("rethrows a failure that isn't the window's, and an answer it can't read", async () => {
    const first = new Threads();
    const unexpected = new RangeError("Unexpected.");
    first.requests.fail(TestPullRequestHost.threadsMethod, unexpected);
    const rejected: Promise<unknown> = UnhandledRejections.nextAsync();
    await first.openAsync();
    const thrown: unknown = await rejected;
    TestBed.resetTestingModule();

    const second = new Threads();
    second.requests.answer(TestPullRequestHost.threadsMethod, { threads: [] });
    const refused: Promise<unknown> = UnhandledRejections.nextAsync();
    await second.openAsync();

    expect(thrown).toBe(unexpected);
    expect(await refused).toMatchObject({ name: "JsonException", path: "$.hasMore" });
    expect([first.context.callsOf("log"), second.context.callsOf("log")]).toEqual([[], []]);
  });

  it("reads again for another pull request, and drops an answer or failure for the one it left", async () => {
    const threads = new Threads();
    const release = threads.requests.hold(TestPullRequestHost.threadsMethod);
    const reject = threads.requests.holdFailure(TestPullRequestHost.threadsMethod);
    threads.answer(pending);
    threads.create();
    await threads.requests.askedAsync(1);

    threads.fixture?.componentRef.setInput("reference", other);
    await threads.requests.askedAsync(2);
    threads.fixture?.componentRef.setInput("reference", reference);
    await threads.untilAsync(() => threads.texts(".comment").length === 1);
    release(new HostPullRequestThreads([general], false).toJson());
    reject(new WindowFailure("The runtime stopped."));
    await threads.settleAsync();

    expect(threads.requests.payloads).toEqual([reference.toJson(), other.toJson(), reference.toJson()]);
    expect([threads.texts(".comment"), threads.element.querySelector("[role=alert]")]).toEqual([[expect.stringContaining("Waiting on design.")], null]);
  });

  it("offers Go to line on a thread on a file's line only, and passes on the thread's id, file and line", async () => {
    const threads = await new Threads().answer(onLine, resolved, general).openAsync();
    threads.find(".fold").click();
    await threads.settleAsync();
    const offered: number = threads.element.querySelectorAll(".go-to-line").length;

    threads.button(".go-to-line").click();

    expect([offered, threads.lines]).toEqual([1, [new ThreadLine(1, "/src/notes-export.ts", 42)]]);
  });

  it("passes on a link a comment opens, with the gesture that opened it", async () => {
    const threads = await new Threads().answer(new HostThread(1, ThreadStatus.Active, null, null,
      [new HostComment(1, null, octocat, PUBLISHED, "See [the spec](https://example.com/spec).")])).openAsync();
    await threads.untilAsync(() => threads.element.querySelector(".comment a") !== null);

    threads.find(".comment a").click();
    await threads.settleAsync();

    expect(threads.opened).toEqual([expect.objectContaining({ url: "https://example.com/spec", gesture: expect.anything() })]);
  });

  it("opens the reply field on Reply and focuses it, replies only on the person's click with the draft as the thread's answer to its first comment, then shows the reply and closes the field", async () => {
    const threads = await new Threads().answer(onLine).openAsync();
    const reply = new HostComment(3, 1, monalisa, PUBLISHED + 120_000, "Done in **the next** commit.");
    threads.requests.answer(TestPullRequestHost.replyMethod, reply.toJson());
    const closed: readonly unknown[] = [threads.element.querySelector("textarea"), threads.texts(".start-reply")];
    threads.button(".start-reply").click();
    await threads.settleAsync();
    const focused: boolean = document.activeElement === threads.draft();
    const empty: boolean = threads.button(".send").disabled;
    await threads.typeAsync("   ");
    const blank: boolean = threads.button(".send").disabled;

    await threads.typeAsync("Done in **the next** commit.");
    const asked: readonly unknown[] = [...threads.requests.methods];
    threads.button(".send").click();
    await threads.settleAsync();

    expect([closed, focused, empty, blank, asked]).toEqual([[null, ["Reply"]], true, true, true, [TestPullRequestHost.threadsMethod]]);
    expect([threads.requests.methods.slice(1), threads.requests.payloads.slice(1)]).toEqual([[TestPullRequestHost.replyMethod],
      [{ reference: reference.toJson(), thread: 1, parent: 1, body: "Done in **the next** commit." }]]);
    expect(threads.texts(".comment-main .name")).toEqual(["octocat@fabrikam.com", "monalisa@fabrikam.com", "monalisa@fabrikam.com"]);
    expect([threads.element.querySelector("textarea"), threads.texts(".start-reply"), threads.element.querySelector("[role=alert]")]).toEqual([null, ["Reply"], null]);
  });

  it("resolves an open thread and reactivates a finished one, one click each, keeping the thread open to show it", async () => {
    const threads = await new Threads().answer(onLine, resolved).openAsync();
    threads.requests.answer(TestPullRequestHost.changeMethod, null, null);
    threads.find(".fold").click();
    await threads.settleAsync();
    const labels: string[] = threads.texts(".change");

    for (const button of [...threads.element.querySelectorAll(".change")].filter(t => t instanceof HTMLButtonElement))
      button.click();
    await threads.settleAsync();

    expect(labels).toEqual(["Resolve", "Reactivate"]);
    expect(threads.requests.payloads.slice(1)).toEqual([{ reference: reference.toJson(), thread: 1, state: "Resolved" },
      { reference: reference.toJson(), thread: 2, state: "Active" }]);
    expect([threads.texts(".thread-state"), threads.texts(".change"), threads.element.querySelector(".fold"), threads.texts(".threads-head")]).toEqual([
      ["Resolved", "Active"], ["Reactivate", "Resolve"], null, ["Comments 1 open thread"]]);
  });

  it("asks before resolving the last open thread of an auto-completing pull request, and resolves another one or reactivates at once", async () => {
    const threads = await new Threads().answer(onLine, pending, resolved).openAsync();
    threads.fixture?.componentRef.setInput("isAutoComplete", true);
    threads.requests.answer(TestPullRequestHost.changeMethod, null, null, null);
    threads.find(".fold").click();
    await threads.settleAsync();
    const changes = (): HTMLButtonElement[] => [...threads.element.querySelectorAll(".change")].filter(t => t instanceof HTMLButtonElement);

    changes()[0]?.click();
    await threads.settleAsync();
    const first: boolean = threads.element.querySelector(".change-confirm") === null;
    changes()[1]?.click();
    await threads.settleAsync();
    const confirm: string[] = threads.texts(".change-confirm");
    const asked: number = threads.requests.payloads.length;
    threads.button(".change-confirm .cancel").click();
    await threads.settleAsync();
    const cancelled: boolean = threads.element.querySelector(".change-confirm") === null;
    changes()[1]?.click();
    await threads.settleAsync();
    threads.button(".change-confirm .confirm").click();
    await threads.settleAsync();
    changes()[2]?.click();
    await threads.settleAsync();

    expect([first, confirm, asked, cancelled, threads.element.querySelector(".change-confirm")]).toEqual([true,
      ["This is the last open thread of a pull request that completes by itself, so resolving it may merge it at once. Cancel Resolve anyway"], 2, true, null]);
    expect(threads.requests.payloads.slice(1)).toEqual([{ reference: reference.toJson(), thread: 1, state: "Resolved" },
      { reference: reference.toJson(), thread: 4, state: "Resolved" }, { reference: reference.toJson(), thread: 2, state: "Active" }]);
  });

  it("drops a confirm it shows for a pull request it left", async () => {
    const threads = await new Threads().answer(onLine).openAsync();
    threads.fixture?.componentRef.setInput("isAutoComplete", true);
    threads.answer(onLine);
    threads.button(".change").click();
    await threads.settleAsync();
    const shown: boolean = threads.element.querySelector(".change-confirm") !== null;

    threads.fixture?.componentRef.setInput("reference", other);
    await threads.settleAsync();

    expect([shown, threads.element.querySelector(".change-confirm"), threads.requests.methods.filter(t => t === TestPullRequestHost.changeMethod)])
      .toEqual([true, null, []]);
  });

  it("holds the thread's draft and buttons while a write is on its way", async () => {
    const threads = await new Threads().answer(onLine).openAsync();
    const release = threads.requests.hold(TestPullRequestHost.changeMethod);
    await threads.typeAsync("Fixed.");

    threads.button(".change").click();
    await threads.requests.askedAsync(2);
    await threads.untilAsync(() => threads.draft().disabled);
    const held = [threads.draft().disabled, threads.button(".change").disabled, threads.button(".send").disabled, threads.find(".thread").getAttribute("aria-busy")];
    release(null);
    await threads.settleAsync();

    expect(held).toEqual([true, true, true, "true"]);
    expect([threads.draft().disabled, threads.button(".change").disabled, threads.button(".send").disabled, threads.draft().value]).toEqual([false, false, false, "Fixed."]);
  });

  it("shows a write's failure under its thread, the runtime's message or that the host didn't answer, keeps the draft, sends nothing again and logs no text", async () => {
    const threads = await new Threads().answer(onLine).openAsync();
    const cannotWrite = "The token can't write comments.";
    threads.requests.fail(TestPullRequestHost.replyMethod, new RuntimeRequestException(FailureCode.Unauthorized, cannotWrite));
    threads.requests.fail(TestPullRequestHost.changeMethod, new WindowFailure("The runtime stopped."));
    await threads.typeAsync("Local times apply.");

    threads.button(".send").click();
    await threads.settleAsync();
    const replyFailure: string[] = threads.texts(".answer-failure");
    threads.button(".change").click();
    await threads.settleAsync();

    expect([replyFailure, threads.texts(".answer-failure")]).toEqual([[`error ${cannotWrite}`], ["error Example didn't answer, so nothing changed. Try again."]]);
    expect([threads.draft().value, threads.texts(".thread-state"), threads.texts(".comment").length]).toEqual(["Local times apply.", ["Active"], 2]);
    expect(threads.requests.methods.slice(1)).toEqual([TestPullRequestHost.replyMethod, TestPullRequestHost.changeMethod]);
    const logs: string[] = threads.context.callsOf("log").map(t => String(t[0]));
    expect([logs.length, logs.filter(t => t.includes("Local times"))]).toEqual([2, []]);
    expect(logs[0]).toContain("The Example module's git-example.replyToThread request failed");
  });

  it("drops a write's answer or failure for a pull request it left", async () => {
    const threads = await new Threads().answer(onLine, pending).openAsync();
    const release = threads.requests.hold(TestPullRequestHost.replyMethod);
    const reject = threads.requests.holdFailure(TestPullRequestHost.changeMethod);
    threads.answer(general);
    await threads.typeAsync("Fixed.");
    threads.button(".send").click();
    threads.button("article:nth-of-type(2) .change").click();
    await threads.requests.askedAsync(3);

    threads.fixture?.componentRef.setInput("reference", other);
    await threads.untilAsync(() => threads.texts(".comment").length === 1);
    release(new HostComment(3, 1, monalisa, PUBLISHED, "Fixed.").toJson());
    reject(new WindowFailure("The runtime stopped."));
    await threads.settleAsync();

    expect([threads.texts(".comment").length, threads.element.querySelector("[role=alert]"), threads.element.querySelector("textarea"),
      threads.button(".start-reply").disabled]).toEqual([1, null, null, false]);
  });

  it("rethrows a write's failure that isn't the window's", async () => {
    const threads = await new Threads().answer(onLine).openAsync();
    const unexpected = new RangeError("Unexpected.");
    threads.requests.fail(TestPullRequestHost.changeMethod, unexpected);
    const rejected: Promise<unknown> = UnhandledRejections.nextAsync();

    threads.button(".change").click();

    expect(await rejected).toBe(unexpected);
    expect(threads.context.callsOf("log")).toEqual([]);
  });
  it("says the host keeps older comments than it answered, and nothing of the kind when it answered them all", async () => {
    const older = new Threads();
    older.requests.answer(TestPullRequestHost.threadsMethod, new HostPullRequestThreads([general], true).toJson());
    await older.openAsync();
    const shown: string[] = older.texts(".threads-more");
    TestBed.resetTestingModule();
    const all = await new Threads().answer(general).openAsync();

    expect([shown, all.texts(".threads-more")]).toEqual([["Showing the newest comments. Older ones are on Example."], []]);
  });

  it("shows no Reply for a host that can't reply, no Resolve or Reactivate for one that keeps no thread state, and no answer row for one with neither", async () => {
    const noReply = new Threads();
    noReply.host.replyToThreadMethod = null;
    await noReply.answer(onLine).openAsync();
    const noReplyButtons: string[] = noReply.texts(".answer-actions button");
    const noReplyDraft: Element | null = noReply.element.querySelector("textarea");
    TestBed.resetTestingModule();
    const noChange = new Threads();
    noChange.host.changeThreadMethod = null;
    await noChange.answer(onLine).openAsync();
    const noChangeButtons: string[] = noChange.texts(".answer-actions button");
    TestBed.resetTestingModule();
    const neither = new Threads();
    neither.host.replyToThreadMethod = null;
    neither.host.changeThreadMethod = null;
    await neither.answer(onLine, resolved).openAsync();
    neither.find(".fold").click();
    await neither.settleAsync();

    expect([noReplyButtons, noReplyDraft, noChangeButtons,
      neither.element.querySelector(".answer"), neither.texts(".comment").length]).toEqual([["Resolve"], null, ["Reply"], null, 4]);
  });

  it("asks the host for each comment author's picture once they come into view, for the pull request they're on, and shows the picture it answers", async () => {
    const threads = new Threads();
    threads.host.avatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    await threads.answer(general).openAsync();

    await threads.untilAsync(() => threads.element.querySelector(".comment nol-avatar img") !== null);

    expect([...new Set(threads.host.askedPeople)]).toEqual(["fabrikam/monalisa@fabrikam.com"]);
  });
});
