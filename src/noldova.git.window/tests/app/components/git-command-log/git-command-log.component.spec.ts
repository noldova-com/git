/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { FailureCode, GitCommand, GitCommandLog } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";

import { GitCommandLogComponent } from "../../../../src/app/components/git-command-log/git-command-log.component.ts";
import { GitRuntimeClient } from "../../../../src/app/services/git-runtime-client.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";
import { RightEdge } from "../../../fixtures/right-edge.fixture.ts";
import { Wait } from "../../../fixtures/wait.fixture.ts";

class MountedLog {
  public readonly fixture: ComponentFixture<GitCommandLogComponent>;
  public readonly element: HTMLElement;
  public readonly handled: WritableSignal<string[]>;
  public readonly shown: WritableSignal<string | null>;

  public constructor(fixture: ComponentFixture<GitCommandLogComponent>, element: HTMLElement, handled: WritableSignal<string[]>, shown: WritableSignal<string | null>) {
    this.fixture = fixture;
    this.element = element;
    this.handled = handled;
    this.shown = shown;
  }
}

describe("GitCommandLogComponent", () => {
  const at: string = "2026-11-22T18:05:00Z";
  const push: GitCommand = new GitCommand("2", at, `git push --porcelain -- origin 8c41e0a:refs/heads/${"feature/".repeat(40)}graph`, 1, 1_250);
  const commands: GitCommandLog = new GitCommandLog([new GitCommand("1", at, "git add -- a.txt", 0, 40), push, new GitCommand("3", at, "git fetch --quiet", null, 30_000)]);

  const mount = (context: FakeWindowPartContext): MountedLog => {
    const shown: WritableSignal<string | null> = GitFixtures.setUp(context);
    const handled: WritableSignal<string[]> = signal<string[]>([]);
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.update(t => [...t, String(error)]));
    const fixture: ComponentFixture<GitCommandLogComponent> = TestBed.createComponent(GitCommandLogComponent);
    fixture.componentRef.setInput("instance", GitFixtures.folder);
    fixture.autoDetectChanges();
    return new MountedLog(fixture, fixture.nativeElement, handled, shown);
  };
  const until = (done: () => boolean): Promise<void> => Wait.until(done);
  const rows = (element: HTMLElement): string[][] =>
    [...element.querySelectorAll(".command")].map(row => [...row.children].map(t => (t.children.length === 0 ? [t] : [...t.children]).map(u => (u.textContent ?? "").trim()).join(" ")));
  const requests = (context: FakeWindowPartContext): readonly (readonly unknown[])[] => context.callsOf("requestAsync").filter(t => t[0] !== "git.status");
  const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);

  it("lists the commands oldest first, the newest at the end, with when each started, its line, how it ended and how long it took, cutting a long line in its column", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commandLog": commands.toJson() });
    const { element } = mount(context);
    await until(() => element.querySelectorAll(".command").length === 3);
    const time: string = new Date(at).toLocaleTimeString("en-US");
    const line: HTMLElement | null = element.querySelector<HTMLElement>(".command:nth-child(2) .line");
    const row: DOMRect = element.querySelector(".command")?.getBoundingClientRect() ?? new DOMRect();
    const list: DOMRect = element.querySelector(".commands")?.getBoundingClientRect() ?? new DOMRect();

    expect(rows(element)).toEqual([
      [time, "git add -- a.txt", "check_circle Done", "40 ms"],
      [time, push.line, "error Exit code 1", "1.3 s"],
      [time, "git fetch --quiet", "do_not_disturb_on Didn't finish", "30.0 s"]
    ]);
    expect([...element.querySelectorAll(".exit")].map(t => t.className)).toEqual(["exit ok", "exit failure", "exit muted"]);
    expect([line?.title, (line?.scrollWidth ?? 0) > (line?.clientWidth ?? 0), rem(row.height), rem(row.left - list.left), rem(row.width) === rem(list.width)]).toEqual([
      push.line, true, 1.75, 0, true
    ]);
  });

  it("ends every row's duration, whatever its length, on the list's right edge", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commandLog": commands.toJson() });
    const { element } = mount(context);
    await until(() => element.querySelectorAll(".command").length === 3);
    const list: Element | null = element.querySelector(".commands");
    const edge: number = Object.isNull(list) ? 0 : RightEdge.contentOf(list);

    expect([1, 2, 3].flatMap(t => RightEdge.missesOf(element, edge, [`.command:nth-child(${String(t)}) .duration`]))).toEqual([]);
    await page.screenshot({ element, path: "../../../../../../_build/window/screenshots/git-command-log.png" });
  });

  it("draws no card, heading, help text or line between rows, the first row at its top and each row's time at its edge", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commandLog": commands.toJson() });
    const { element } = mount(context);
    await until(() => element.querySelectorAll(".command").length === 3);
    const panel: HTMLElement = element.querySelector<HTMLElement>(".panel") ?? element;
    const leftOf = (selector: string): number => rem((element.querySelector(selector)?.getBoundingClientRect().left ?? 0) - element.getBoundingClientRect().left);

    expect([getComputedStyle(element).padding, getComputedStyle(panel).backgroundColor, getComputedStyle(panel).borderTopWidth]).toEqual(["0px", "rgba(0, 0, 0, 0)", "0px"]);
    const top: number = rem((element.querySelector(".command")?.getBoundingClientRect().top ?? -1) - element.getBoundingClientRect().top);
    const lines: readonly string[] = [...element.querySelectorAll(".command")].flatMap(t => [getComputedStyle(t).borderTopWidth, getComputedStyle(t).borderBottomWidth]);

    expect([element.querySelectorAll("h1, h2, header, .hint, hr").length, top, leftOf(".command .time"), new Set(lines)]).toEqual([0, 0, 0, new Set(["0px"])]);
  });

  it("keeps the newest row in sight as commands arrive, and leaves the list where it is once the person has scrolled up, before any scroll event", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let count: number = 30;
    const logOf = (): GitCommandLog => new GitCommandLog(Array.from({ length: count }, (_, index) => new GitCommand(String(index), at, `git add -- f${index}.txt`, 0, 40)));
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commandLog": () => logOf().toJson() });
    const { element } = mount(context);
    element.style.height = "10rem";
    const list = (): HTMLElement => element.querySelector<HTMLElement>(".commands") ?? element;
    const gapUnderLast = (): number => rem(list().getBoundingClientRect().bottom - (element.querySelector(".command:last-child")?.getBoundingClientRect().bottom ?? 0));
    const arriveAsync = async (more: number): Promise<void> => {
      count += more;
      context.raiseEvent("git.changed", { folder: GitFixtures.folder });
      await until(() => element.querySelectorAll(".command").length === count);
      await Wait.drainedAsync();
    };
    await until(() => element.querySelectorAll(".command").length === count);
    await Wait.drainedAsync();
    const opened: number = gapUnderLast();
    await arriveAsync(5);
    const followed: number = gapUnderLast();
    list().scrollTop = 0;
    await arriveAsync(5);

    expect([opened, followed, list().scrollTop, rem((element.querySelector(".command")?.getBoundingClientRect().top ?? -1) - list().getBoundingClientRect().top)]).toEqual([0, 0, 0, 0]);
  });

  it("keeps the newest row in sight when the list shrinks at its end, and leaves a list scrolled up where it is", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const log: GitCommandLog = new GitCommandLog(Array.from({ length: 30 }, (_, index) => new GitCommand(String(index), at, `git add -- f${index}.txt`, 0, 40)));
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commandLog": log.toJson() });
    const { element } = mount(context);
    element.style.height = "10rem";
    const list = (): HTMLElement => element.querySelector<HTMLElement>(".commands") ?? element;
    const gapUnderLast = (): number => rem(list().getBoundingClientRect().bottom - (element.querySelector(".command:last-child")?.getBoundingClientRect().bottom ?? 0));
    const resizeAsync = async (height: string): Promise<void> => {
      const before: number = list().clientHeight;
      let seen: boolean = false;
      const observer: ResizeObserver = new ResizeObserver(() => {
        seen = list().clientHeight !== before;
      });
      observer.observe(list());
      element.style.height = height;
      await until(() => seen);
      observer.disconnect();
    };
    await until(() => element.querySelectorAll(".command").length === 30);
    await Wait.drainedAsync();
    await resizeAsync("6rem");
    const shrunk: number = gapUnderLast();
    list().scrollTop = 0;
    await resizeAsync("5rem");

    expect([shrunk, list().scrollTop]).toEqual([0, 0]);
  });

  it("says no command ran yet, and reads the log again each time the repository changes", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let log: GitCommandLog = new GitCommandLog([]);
    let fingerprint: number = 1;
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.status": () => GitFixtures.status([], null, { fingerprint: `f${fingerprint}` }).toJson(), "git.commandLog": () => log.toJson()
    });
    const { element } = mount(context);
    await until(() => !Object.isNull(element.querySelector(".note")));
    const empty: string | undefined = element.querySelector(".note")?.textContent?.trim();

    log = commands;
    fingerprint = 2;
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await until(() => element.querySelectorAll(".command").length === 3);

    expect([empty, element.querySelector(".note")]).toEqual(["No git commands yet: each write you make here shows its command as it runs.", null]);
  });

  it("drops a read's log or failure once a later read started, keeping the later one's", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let fingerprint: number = 1;
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.commandLog"], {
      ...GitFixtures.watching, "git.status": () => GitFixtures.status([], null, { fingerprint: `f${fingerprint}` }).toJson()
    });
    const reads = vi.spyOn(GitRuntimeClient.prototype, "commandLogAsync");
    onTestFinished(() => reads.mockRestore());
    const { fixture, element } = mount(context);
    const changed = (): void => {
      fingerprint += 1;
      context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    };
    const settledAsync = async (): Promise<void> => {
      await Promise.allSettled(reads.mock.results.flatMap(t => t.type === "return" ? [t.value] : []));
      await fixture.whenStable();
    };

    const first = await held.nextAsync("git.commandLog");
    changed();
    const second = await held.nextAsync("git.commandLog");
    second(GitFixtures.failure(FailureCode.Unavailable, null, "Git can't run."));
    await until(() => !Object.isNull(element.querySelector(".failure")));
    first(commands.toJson());
    await settledAsync();
    const failed: readonly unknown[] = [element.querySelector(".failure")?.textContent?.trim(), element.querySelectorAll(".command").length];
    changed();
    const third = await held.nextAsync("git.commandLog");
    changed();
    const fourth = await held.nextAsync("git.commandLog");
    fourth(new GitCommandLog([]).toJson());
    await until(() => !Object.isNull(element.querySelector(".note:not(.failure)")));
    third(GitFixtures.failure(FailureCode.Unavailable, null, "Old failure."));
    await settledAsync();

    expect([failed, element.querySelector(".failure"), !Object.isNull(element.querySelector(".note:not(.failure)"))]).toEqual([["Git can't run.", 0], null, true]);
  });

  it("says why a read failed, keeps a later read's log over an earlier one's, and reports a failure outside Git", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commandLog": GitFixtures.failure(FailureCode.Unavailable, null, "Git can't run.") });
    const { element, handled } = mount(context);
    await until(() => !Object.isNull(element.querySelector(".failure")));
    const failed: string | undefined = element.querySelector(".failure")?.textContent?.trim();

    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status([], null, { fingerprint: "f2" }).toJson(), "git.commandLog": new Error("log broke") });
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await until(() => handled().length > 0);

    expect([failed, handled()]).toEqual(["Git can't run.", ["Error: log broke"]]);
  });

  it("watches its own repository while it is open, whichever repository the Git view shows, and reads again only when that repository changes", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const { fixture, shown } = mount(context);
    shown.set("/work/other");
    await until(() => requests(context).length === 2);
    context.raiseEvent("git.changed", { folder: "/work/other" });
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await until(() => requests(context).length === 3);
    fixture.destroy();
    await until(() => requests(context).length === 4);

    expect(requests(context)).toEqual([
      ["git.watch", { folder: GitFixtures.folder }], ["git.commandLog", { folder: GitFixtures.folder }], ["git.commandLog", { folder: GitFixtures.folder }],
      ["git.unwatch", { folder: GitFixtures.folder }]
    ]);
  });

  it("logs that it can't watch its repository, or stop watching it, and still lists the commands", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commandLog": commands.toJson(),
      "git.watch": GitFixtures.failure(FailureCode.Unavailable, null, "No watcher."), "git.unwatch": GitFixtures.failure(FailureCode.Unavailable, null, "Gone.")
    });
    const { fixture, element } = mount(context);
    await until(() => element.querySelectorAll(".command").length === 3 && context.callsOf("log").length === 1);
    fixture.destroy();
    await until(() => context.callsOf("log").length === 2);

    expect(context.callsOf("log")).toEqual([
      [`The command log of ${GitFixtures.folder} doesn't follow new commands, since the folder couldn't be watched: No watcher.`],
      [`The command log couldn't stop watching ${GitFixtures.folder}: Gone.`]
    ]);
  });
});
