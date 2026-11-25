/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitPullRequestsComponent } from "../../../../src/app/components/git-pull-requests/git-pull-requests.component.ts";
import type { IGitPullRequests } from "../../../../src/app/interfaces/i-git-pull-requests.ts";
import { GitPullRequestList } from "../../../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../../../src/app/models/git-pull-request-row.ts";
import { GitPullRequests } from "../../../../src/app/services/git-pull-requests.ts";

describe("GitPullRequestsComponent", () => {
  const remoteOf = (path: string = "example-owner/example-repository"): GitRemote => new GitRemote("origin", "github.com", path, RemoteTransport.Https);
  const rowOf = (n: number, counts: Partial<Pick<GitPullRequestRow, "isDraft" | "approvals" | "passed" | "failing" | "pending">> = {}): GitPullRequestRow =>
    new GitPullRequestRow(`pull-${n}`, `#${n}`, `Change ${n}`, `https://github.com/example-owner/example-repository/pull/${n}`, counts.isDraft ?? false, counts.approvals ?? 0,
      counts.passed ?? 0, counts.failing ?? 0, counts.pending ?? 0, `change-${n}`);

  interface IMounted {
    readonly fixture: ComponentFixture<GitPullRequestsComponent>;
    readonly element: HTMLElement;
    readonly context: FakeWindowPartContext;
    readonly list: WritableSignal<GitPullRequestList | null>;
    readonly refreshed: string[];
    readonly handled: unknown[];
  }

  const mount = async (host: Partial<IGitPullRequests> = {}): Promise<IMounted> => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const list: WritableSignal<GitPullRequestList | null> = signal<GitPullRequestList | null>(null);
    const refreshed: string[] = [];
    const handled: unknown[] = [];
    onTestFinished(GitPullRequests.provide(context, {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "git-github.account",
      listFor: () => list, refresh: (folder, remote) => refreshed.push(`${folder} ${remote.path ?? ""}`), ...host
    }));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(error));
    const fixture: ComponentFixture<GitPullRequestsComponent> = TestBed.createComponent(GitPullRequestsComponent);
    fixture.componentRef.setInput("folder", "/work/site");
    fixture.componentRef.setInput("remote", remoteOf());
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement, context, list, refreshed, handled };
  };
  const texts = (element: HTMLElement, selector: string): string[] => [...element.querySelectorAll(selector)].map(t =>
    (t.children.length === 0 ? [t] : [...t.children]).map(u => (u.textContent ?? "").trim()).filter(u => u.length > 0).join(" "));
  const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
  const click = async (mounted: IMounted, selector: string): Promise<void> => {
    mounted.element.querySelector<HTMLElement>(selector)?.click();
    await mounted.fixture.whenStable();
  };

  it("lists the first 20 pull requests with a dot and a note each, the header saying there are more, in the panel's row geometry", async () => {
    const mounted: IMounted = await mount();
    mounted.list.set(GitPullRequestList.ready([
      rowOf(1, { failing: 2, pending: 1, approvals: 1 }), rowOf(2, { pending: 1, passed: 3 }), rowOf(3, { approvals: 1, passed: 1 }), rowOf(4, { approvals: 2, isDraft: true }),
      rowOf(5, { isDraft: true }), rowOf(6), ...Array.from({ length: 15 }, (_, i) => rowOf(7 + i))
    ]));
    await mounted.fixture.whenStable();
    const row: DOMRect = mounted.element.querySelector(".pull-request")?.getBoundingClientRect() ?? new DOMRect();
    const dot: DOMRect = mounted.element.querySelector(".pull-request .dot")?.getBoundingClientRect() ?? new DOMRect();
    const title: DOMRect = mounted.element.querySelector(".pull-request .title")?.getBoundingClientRect() ?? new DOMRect();

    expect(texts(mounted.element, ".section .host")).toEqual(["GitHub · 20+"]);
    expect(texts(mounted.element, ".pull-request")).toHaveLength(20);
    expect(texts(mounted.element, ".pull-request").slice(0, 6)).toEqual([
      "#1 Change 1 2 failing", "#2 Change 2 checks running", "#3 Change 3 1 review", "#4 Change 4 2 reviews", "#5 Change 5 Draft", "#6 Change 6"
    ]);
    expect([...mounted.element.querySelectorAll(".pull-request .dot")].slice(0, 6).map(t => t.className)).toEqual(["dot failed", "dot pending", "dot ok", "dot none", "dot none", "dot none"]);
    expect([rem(row.height), rem(dot.width), rem(dot.height), rem(dot.left - row.left), rem(title.left - row.left)]).toEqual([1.625, 0.5, 0.5, 1.875, 3.25]);
    expect([mounted.element.querySelector(".pull-request")?.getAttribute("title"), mounted.element.querySelector(".pull-request .title nol-git-reference-text ~ span")?.getAttribute("title")])
      .toEqual([null, "Change 1"]);
  });

  it("shows only the host's name in the header up to 20, and folds the section closed and open", async () => {
    const mounted: IMounted = await mount();
    mounted.list.set(GitPullRequestList.ready(Array.from({ length: 20 }, (_, i) => rowOf(i + 1))));
    await mounted.fixture.whenStable();
    const shown: readonly unknown[] = [texts(mounted.element, ".section .host"), mounted.element.querySelectorAll(".pull-request").length];

    await click(mounted, ".toggle");
    const folded: readonly unknown[] = [mounted.element.querySelectorAll(".pull-request").length, mounted.element.querySelector(".toggle")?.getAttribute("aria-expanded")];
    await click(mounted, ".toggle");

    expect([shown, folded, mounted.element.querySelectorAll(".pull-request").length]).toEqual([[["GitHub"], 20], [0, "false"], 20]);
  });

  it("asks the host to read when it first shows a folder, again for another folder or remote but not an equal remote, and when the window takes the focus", async () => {
    const mounted: IMounted = await mount();
    mounted.fixture.componentRef.setInput("remote", remoteOf());
    await mounted.fixture.whenStable();
    const first: readonly string[] = [...mounted.refreshed];
    mounted.fixture.componentRef.setInput("folder", "/work/other");
    await mounted.fixture.whenStable();
    mounted.fixture.componentRef.setInput("remote", remoteOf("example-owner/fork"));
    await mounted.fixture.whenStable();
    window.dispatchEvent(new FocusEvent("focus"));

    expect([first, mounted.refreshed]).toEqual([
      ["/work/site example-owner/example-repository"],
      ["/work/site example-owner/example-repository", "/work/other example-owner/example-repository", "/work/other example-owner/fork", "/work/other example-owner/fork"]
    ]);
  });

  it("says the host reads until it answers, keeps the last rows while it reads again, says when there are none, and offers a signed-out host's sign-in in Settings", async () => {
    const mounted: IMounted = await mount();
    mounted.context.answer("runCommandAsync", () => Promise.resolve(null));
    const notes: string[][] = [texts(mounted.element, ".note")];
    mounted.list.set(GitPullRequestList.reading());
    await mounted.fixture.whenStable();
    notes.push(texts(mounted.element, ".note"));
    mounted.list.set(GitPullRequestList.reading([rowOf(7)]));
    await mounted.fixture.whenStable();
    notes.push(texts(mounted.element, ".pull-request"));
    mounted.list.set(GitPullRequestList.ready([]));
    await mounted.fixture.whenStable();
    notes.push(texts(mounted.element, ".note"));
    mounted.list.set(GitPullRequestList.signedOut());
    await mounted.fixture.whenStable();
    notes.push(texts(mounted.element, ".link"));
    await click(mounted, ".link");

    expect(notes).toEqual([["Reading pull requests…"], ["Reading pull requests…"], ["#7 Change 7"], ["No open pull requests"], ["Sign in to see pull requests"]]);
    expect(mounted.context.callsOf("runCommandAsync")).toEqual([["desktop.openSettings", { page: "git-github.account" }]]);
  });

  it("says why a read failed, in the error colour, with Try again that asks the host to read again", async () => {
    const mounted: IMounted = await mount();
    mounted.list.set(GitPullRequestList.failed("GitHub answered 502."));
    await mounted.fixture.whenStable();
    const failure: Element | null = mounted.element.querySelector(".failure");
    const before: number = mounted.refreshed.length;
    await click(mounted, ".retry");

    expect([texts(mounted.element, ".failure .note"), failure?.getAttribute("role"), mounted.refreshed.length - before]).toEqual([["GitHub answered 502."], "alert", 1]);
    expect(texts(mounted.element, ".retry")).toEqual(["Try again"]);
  });

  it("opens a pull request in the host's own page by its key when the host opens it, and otherwise its page in the browser", async () => {
    const opened: string[] = [];
    const mounted: IMounted = await mount({
      open: (folder, row) => {
        opened.push(`${folder} ${row.key}`);
        return row.key === "pull-1";
      }
    });
    mounted.context.answer("openLinkAsync", () => Promise.resolve());
    mounted.list.set(GitPullRequestList.ready([rowOf(1), rowOf(2)]));
    await mounted.fixture.whenStable();
    const rows: HTMLElement[] = [...mounted.element.querySelectorAll<HTMLElement>(".pull-request")];
    rows[0]?.click();
    rows[1]?.click();
    await mounted.fixture.whenStable();

    expect([opened, mounted.context.callsOf("openLinkAsync")]).toEqual([
      ["/work/site pull-1", "/work/site pull-2"], [["https://github.com/example-owner/example-repository/pull/2", { place: LinkPlace.System }]]
    ]);
  });

  it("makes each row's number the link to its pull request, whose click opens it once as the row's does, and keeps the whole row a click target", async () => {
    const opened: string[] = [];
    const mounted: IMounted = await mount({ open: (folder, row) => opened.push(`${folder} ${row.key}`) > 0 });
    mounted.list.set(GitPullRequestList.ready([rowOf(1)]));
    await mounted.fixture.whenStable();
    const row: HTMLElement | null = mounted.element.querySelector<HTMLElement>(".pull-request");
    const link: HTMLAnchorElement | null = mounted.element.querySelector<HTMLAnchorElement>(".pull-request a");

    link?.click();
    await mounted.fixture.whenStable();
    const linkOpened: readonly string[] = [...opened];
    row?.click();
    await mounted.fixture.whenStable();

    expect([row?.tagName, row === null ? null : getComputedStyle(row).cursor, link?.getAttribute("href"), link?.textContent, linkOpened, opened]).toEqual([
      "DIV", "pointer", "https://github.com/example-owner/example-repository/pull/1", "#1", ["/work/site pull-1"], ["/work/site pull-1", "/work/site pull-1"]]);
  });

  it("opens the page in the browser for a host with no page of its own, and reports a link or a sign-in the window couldn't open", async () => {
    const mounted: IMounted = await mount();
    mounted.context.answer("openLinkAsync", () => Promise.reject(new Error("no browser")));
    mounted.context.answer("runCommandAsync", () => Promise.reject(new Error("no settings")));
    mounted.list.set(GitPullRequestList.ready([rowOf(3)]));
    await mounted.fixture.whenStable();
    await click(mounted, ".pull-request");
    mounted.list.set(GitPullRequestList.signedOut());
    await mounted.fixture.whenStable();
    await click(mounted, ".link");
    await vi.waitUntil(() => mounted.handled.length === 2, { timeout: 5000 });

    expect([mounted.context.callsOf("openLinkAsync").map(t => t[0]), mounted.handled.map(String)]).toEqual([
      ["https://github.com/example-owner/example-repository/pull/3"], ["Error: no browser", "Error: no settings"]
    ]);
  });

  it("reports a host's list or read that throws, reading on as if it had none, and shows nothing for a remote no host claims", async () => {
    const mounted: IMounted = await mount({
      listFor: () => { throw new RangeError("list broke"); },
      refresh: () => { throw new RangeError("read broke"); }
    });
    const reading: string[] = texts(mounted.element, ".note");
    mounted.fixture.componentRef.setInput("remote", new GitRemote("nas", "nas.home", "notes", RemoteTransport.Ssh));
    await mounted.fixture.whenStable();

    expect([reading, mounted.element.children.length, mounted.handled.map(String).sort()]).toEqual([
      ["Reading pull requests…"], 0, ["RangeError: list broke", "RangeError: read broke"]
    ]);
  });

  it("reports a host's page that throws and opens the pull request's page in the browser instead", async () => {
    const mounted: IMounted = await mount({ open: () => { throw new RangeError("page broke"); } });
    mounted.context.answer("openLinkAsync", () => Promise.resolve());
    mounted.list.set(GitPullRequestList.ready([rowOf(4)]));
    await mounted.fixture.whenStable();
    await click(mounted, ".pull-request");

    expect([mounted.handled.map(String), mounted.context.callsOf("openLinkAsync").map(t => t[0])]).toEqual([
      ["RangeError: page broke"], ["https://github.com/example-owner/example-repository/pull/4"]
    ]);
  });
});
