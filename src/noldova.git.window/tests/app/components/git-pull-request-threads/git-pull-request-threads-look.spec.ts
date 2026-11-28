/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { HostComment, HostPerson, HostPullRequestThreads, HostReference, HostThread, ThreadStatus } from "@noldova/git.hosting.protocol";
import { DefaultTheme, type ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";

import { GitPullRequestThreadsComponent } from "../../../../src/app/components/git-pull-request-threads/git-pull-request-threads.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { TestPullRequestHost } from "../../../fixtures/test-pull-request-host.fixture.ts";

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "3f2504e0-4f89-11d3-9a0c-0305e82c3301", 752);

class Hosts {
  public static next: TestPullRequestHost = new TestPullRequestHost();
}

@Component({
  selector: "nol-git-threads-document",
  imports: [GitPullRequestThreadsComponent],
  template: "<div class=\"document\"><nol-git-pull-request-threads [host]=\"host\" [reference]=\"reference\" [isAutoComplete]=\"true\" /></div>",
  styles: [
    ".document { box-sizing: border-box; width: 40rem; color: var(--nol-text); font-family: var(--nol-font-sans); font-size: var(--nol-text-panel);"
    + " line-height: var(--nol-line-panel); }"
  ]
})
class DocumentComponent {
  protected readonly host: TestPullRequestHost = Hosts.next;
  protected readonly reference: HostReference = reference;
}

const octocat: HostPerson = new HostPerson("octocat@fabrikam.test", null, null);
const threads: readonly HostThread[] = [
  new HostThread(1, ThreadStatus.Active, `/src/${"note-exports/".repeat(12)}local-times.ts`, 42, [
    new HostComment(1, null, octocat, 1_800_000_000_000, "Should this respect local times?"),
    new HostComment(2, 1, new HostPerson("monalisa@fabrikam.test", null, null), 1_800_000_060_000, "Yes, it will.")
  ]),
  new HostThread(2, ThreadStatus.Resolved, null, null, [new HostComment(1, null, octocat, 1_800_000_000_000, `Typo ${"in the heading ".repeat(20)}`)])
];

const picture: string = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function openAsync(mode: ThemeMode, host: TestPullRequestHost = new TestPullRequestHost()): Promise<ComponentFixture<DocumentComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, mode);
  const context = new FakeWindowPartContext();
  const requests = new RequestAnswers(context);
  requests.answer(TestPullRequestHost.threadsMethod, new HostPullRequestThreads(threads, false).toJson());
  Hosts.next = host;
  TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
  const fixture = TestBed.createComponent(DocumentComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function all(root: HTMLElement, selector: string): HTMLElement[] {
  return [...root.querySelectorAll(selector)].filter(t => t instanceof HTMLElement);
}

function find(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector(selector);
  if (!(found instanceof HTMLElement))
    throw new Error(`Nothing matches ${selector}.`);
  return found;
}

function untilAsync(done: () => boolean): Promise<void> {
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

function px(rem: number): number {
  return AppearanceFixture.toPixels(rem);
}

function hostWith(reply: string | null, change: string | null, avatar: string | null = null): TestPullRequestHost {
  const host: TestPullRequestHost = new TestPullRequestHost();
  host.replyToThreadMethod = reply;
  host.changeThreadMethod = change;
  host.avatar = avatar;
  return host;
}

describe("GitPullRequestThreadsComponent in the kit's look", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("sets each thread's head and comments inside its card's insets, the forum icon first and centred on the head's words, and Go to line"
    + " at the head's end for a thread on a line only, in %s mode", async mode => {
    const root: HTMLElement = (await openAsync(mode)).nativeElement;
    const [card] = all(root, ".thread");
    if (Object.isUndefined(card))
      throw new Error("No thread is shown.");
    const box = card.getBoundingClientRect();
    const inset: number = px(0.75) + Number.parseFloat(getComputedStyle(card).borderLeftWidth);
    const head = find(card, ".thread-head").getBoundingClientRect();
    const icon = find(card, ".thread-icon").getBoundingClientRect();
    const place = find(card, ".place").getBoundingClientRect();
    const state = find(card, ".thread-state").getBoundingClientRect();
    const [first, reply] = all(card, ".comment nol-avatar").map(t => t.getBoundingClientRect());

    AppearanceFixture.expectPixels(head.left - box.left, inset);
    AppearanceFixture.expectPixels(box.right - head.right, inset);
    AppearanceFixture.expectPixels(head.top - box.top, inset);
    AppearanceFixture.expectPixels(icon.left, head.left);
    AppearanceFixture.expectPixels(place.left - icon.right, px(0.5));
    AppearanceFixture.expectPixels(state.left, place.left);
    const goToLine = find(card, ".go-to-line").getBoundingClientRect();
    AppearanceFixture.expectPixels(goToLine.left - place.right, px(0.5));
    AppearanceFixture.expectPixels(goToLine.right, head.right);
    AppearanceFixture.expectPixels(goToLine.top + goToLine.height / 2, place.top + place.height / 2);
    expect(all(root, ".go-to-line").map(t => t.textContent?.trim())).toEqual(["Go to line"]);
    AppearanceFixture.expectPixels(icon.top + icon.height / 2, place.top + place.height / 2);
    AppearanceFixture.expectPixels(first?.left ?? 0, head.left);
    AppearanceFixture.expectPixels((reply?.left ?? 0) - (first?.left ?? 0), px(1));
  });

  it.each(AppearanceFixture.modes)("shows each comment author's picture from the host at the 1.5rem avatar's size, in its place, in %s mode", async mode => {
    const root: HTMLElement = (await openAsync(mode, hostWith(TestPullRequestHost.replyMethod, TestPullRequestHost.changeMethod, picture))).nativeElement;
    const [card] = all(root, ".thread");
    if (Object.isUndefined(card))
      throw new Error("No thread is shown.");
    await untilAsync(() => all(card, ".comment img").length === 2);
    const images: HTMLElement[] = all(card, ".comment img");
    const avatars: DOMRect[] = all(card, ".comment nol-avatar").map(t => t.getBoundingClientRect());

    expect(images.map(t => t.getAttribute("src"))).toEqual([picture, picture]);
    for (const [i, image] of images.entries()) {
      const box: DOMRect = image.getBoundingClientRect();
      AppearanceFixture.expectPixels(box.width, px(1.5));
      AppearanceFixture.expectPixels(box.height, px(1.5));
      AppearanceFixture.expectPixels(box.left, avatars[i]?.left ?? 0);
    }
  });

  it.each(AppearanceFixture.modes)("ends an open thread with Reply after Resolve at the card's end inset, with no reply field until Reply opens it, in %s mode", async mode => {
    const root: HTMLElement = (await openAsync(mode)).nativeElement;
    const [card] = all(root, ".thread");
    if (Object.isUndefined(card))
      throw new Error("No thread is shown.");
    const box = card.getBoundingClientRect();
    const inset: number = px(0.75) + Number.parseFloat(getComputedStyle(card).borderLeftWidth);
    const change = find(card, ".change").getBoundingClientRect();
    const start = find(card, ".start-reply").getBoundingClientRect();
    const [, last] = all(card, ".comment").map(t => t.getBoundingClientRect());

    expect(card.querySelector("textarea")).toBeNull();
    AppearanceFixture.expectPixels(box.right - start.right, inset);
    AppearanceFixture.expectPixels(start.left - change.right, px(0.5));
    AppearanceFixture.expectPixels(start.top, change.top);
    AppearanceFixture.expectPixels(change.top - (last?.bottom ?? 0), px(0.5));
    AppearanceFixture.expectPixels(box.bottom - start.bottom, inset);
  });

  it.each(AppearanceFixture.modes)("sets the reply field Reply opens in from the comments, its buttons at the card's end inset, Reply after Resolve, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const [card] = all(root, ".thread");
    if (Object.isUndefined(card))
      throw new Error("No thread is shown.");
    find(card, ".start-reply").click();
    await fixture.whenStable();
    const box = card.getBoundingClientRect();
    const inset: number = px(0.75) + Number.parseFloat(getComputedStyle(card).borderLeftWidth);
    const draft = find(card, ".draft").getBoundingClientRect();
    const change = find(card, ".change").getBoundingClientRect();
    const send = find(card, ".send").getBoundingClientRect();

    AppearanceFixture.expectPixels(draft.left - box.left, inset + px(1));
    AppearanceFixture.expectPixels(box.right - draft.right, inset);
    AppearanceFixture.expectPixels(box.right - send.right, inset);
    AppearanceFixture.expectPixels(send.left - change.right, px(0.5));
    AppearanceFixture.expectPixels(send.top, change.top);
    AppearanceFixture.expectPixels(change.top - draft.bottom, px(0.5));
  });

  it.each(AppearanceFixture.modes)("asks before resolving the last open thread in a line between the reply box and its buttons, its buttons at the card's end inset, in %s mode", async mode => {
    const fixture = await openAsync(mode);
    const root: HTMLElement = fixture.nativeElement;
    const [card] = all(root, ".thread");
    if (Object.isUndefined(card))
      throw new Error("No thread is shown.");
    find(card, ".start-reply").click();
    await fixture.whenStable();
    find(card, ".change").click();
    await fixture.whenStable();
    const box = card.getBoundingClientRect();
    const inset: number = px(0.75) + Number.parseFloat(getComputedStyle(card).borderLeftWidth);
    const draft = find(card, ".draft").getBoundingClientRect();
    const line = find(card, ".change-confirm").getBoundingClientRect();
    const cancel = find(card, ".change-confirm .cancel").getBoundingClientRect();
    const confirm = find(card, ".change-confirm .confirm").getBoundingClientRect();
    const change = find(card, ".change").getBoundingClientRect();

    AppearanceFixture.expectPixels(line.left, draft.left);
    AppearanceFixture.expectPixels(box.right - confirm.right, inset);
    AppearanceFixture.expectPixels(confirm.left - cancel.right, px(0.5));
    AppearanceFixture.expectPixels(confirm.top, cancel.top);
    AppearanceFixture.expectPixels(line.top - draft.bottom, px(0.5));
    AppearanceFixture.expectPixels(change.top - line.bottom, px(0.5));
  });

  it.each(AppearanceFixture.modes)("folds a finished thread to one line inside its card, its hover fill 0.25rem from the card and its text 0.75rem in, cutting a long comment short, in %s mode", async mode => {
    const root: HTMLElement = (await openAsync(mode)).nativeElement;
    const [, card] = all(root, ".thread");
    if (Object.isUndefined(card))
      throw new Error("No finished thread is shown.");
    const box = card.getBoundingClientRect();
    const inset: number = px(0.75) + Number.parseFloat(getComputedStyle(card).borderLeftWidth);
    const fold = find(card, ".fold");
    const foldBox = fold.getBoundingClientRect();
    const text = find(fold, ".grow");

    const fill: number = inset - px(0.5);
    AppearanceFixture.expectPixels(foldBox.left - box.left, fill);
    AppearanceFixture.expectPixels(box.right - foldBox.right, fill);
    AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(fold).paddingLeft), px(0.5));
    AppearanceFixture.expectPixels(foldBox.height, px(1.625));
    expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
  });
  it.each(AppearanceFixture.modes)("ends an open thread with Resolve alone at the card's end inset for a host that can't reply, in %s mode", async mode => {
    const root: HTMLElement = (await openAsync(mode, hostWith(null, TestPullRequestHost.changeMethod))).nativeElement;
    const [card] = all(root, ".thread");
    if (Object.isUndefined(card))
      throw new Error("No thread is shown.");
    const box = card.getBoundingClientRect();
    const inset: number = px(0.75) + Number.parseFloat(getComputedStyle(card).borderLeftWidth);
    const change = find(card, ".change").getBoundingClientRect();
    const [, last] = all(card, ".comment").map(t => t.getBoundingClientRect());

    expect([all(card, ".answer-actions button").length, card.querySelector("textarea")]).toEqual([1, null]);
    AppearanceFixture.expectPixels(box.right - change.right, inset);
    AppearanceFixture.expectPixels(change.top - (last?.bottom ?? 0), px(0.5));
    AppearanceFixture.expectPixels(box.bottom - change.bottom, inset);
  });

  it.each(AppearanceFixture.modes)("ends an open thread with Reply alone at the card's end inset for a host that keeps no thread state, in %s mode", async mode => {
    const root: HTMLElement = (await openAsync(mode, hostWith(TestPullRequestHost.replyMethod, null))).nativeElement;
    const [card] = all(root, ".thread");
    if (Object.isUndefined(card))
      throw new Error("No thread is shown.");
    const box = card.getBoundingClientRect();
    const inset: number = px(0.75) + Number.parseFloat(getComputedStyle(card).borderLeftWidth);
    const start = find(card, ".start-reply").getBoundingClientRect();
    const [, last] = all(card, ".comment").map(t => t.getBoundingClientRect());

    expect(all(card, ".answer-actions button").length).toBe(1);
    AppearanceFixture.expectPixels(box.right - start.right, inset);
    AppearanceFixture.expectPixels(start.top - (last?.bottom ?? 0), px(0.5));
    AppearanceFixture.expectPixels(box.bottom - start.bottom, inset);
  });

  it.each(AppearanceFixture.modes)("ends a thread at its last comment, inside the card's inset, for a host that writes neither replies nor states, in %s mode", async mode => {
    const root: HTMLElement = (await openAsync(mode, hostWith(null, null))).nativeElement;
    const [card] = all(root, ".thread");
    if (Object.isUndefined(card))
      throw new Error("No thread is shown.");
    const box = card.getBoundingClientRect();
    const inset: number = px(0.75) + Number.parseFloat(getComputedStyle(card).borderLeftWidth);
    const [, last] = all(card, ".comment").map(t => t.getBoundingClientRect());

    expect(card.querySelector(".answer")).toBeNull();
    AppearanceFixture.expectPixels(box.bottom - (last?.bottom ?? 0), inset);
  });
});
