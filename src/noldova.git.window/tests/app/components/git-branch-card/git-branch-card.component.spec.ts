/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitHooks, StatusUpstream } from "@noldova/git.protocol";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, PointerFixture, TooltipFixture } from "@noldova/ui.components.angular/testing";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitBranchCardComponent", () => {
  const branches = GitFixtures.branches("main", ["main", "sample-branch", "release"], ["origin/sample/4321-long-branch"]).toJson();

  const typeAsync = async (view: GitViewFixture, text: string): Promise<void> => {
    const field: HTMLInputElement | null = view.element.querySelector<HTMLInputElement>(".filter");
    expect(field).not.toBeNull();
    if (field !== null) {
      field.value = text;
      field.dispatchEvent(new Event("input"));
    }
    await view.fixture.whenStable();
  };

  it("names the branch, its upstream and how far apart they are, and pushes what is ahead", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.push": null, "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 2, 1, false)).toJson() });

    const shown: readonly string[] = view.texts(".branch, .push .nol-button-label, .upstream span");
    await view.clickAsync(".push");

    expect(shown).toEqual(["main", "Push 2", "origin/main", "↑2 ahead · ↓1 behind"]);
    expect(view.requested("git.push")).toEqual([{ folder: GitFixtures.folder, basedOn: "f1" }]);
  });

  it("disables Push with nothing ahead, and says so when the upstream is gone", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status([], new StatusUpstream("origin/old", 0, 0, true)).toJson() });

    expect(view.texts(".push .nol-button-label, .upstream span")).toEqual(["Push", "origin/old is gone from its remote"]);
    expect(view.find<HTMLButtonElement>(".push").disabled).toBe(true);
  });

  it("offers to publish a branch with no upstream", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.push": null, "git.status": GitFixtures.status().toJson() });

    const shown: readonly string[] = view.texts(".push .nol-button-label, .upstream span");
    await view.clickAsync(".push");

    expect(shown).toEqual(["Publish branch", "No upstream yet"]);
    expect(view.requested("git.push")).toHaveLength(1);
  });

  it("names a detached HEAD by its short commit and offers no push", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status([], null, { branch: null }).toJson() });

    expect(view.texts(".branch")).toEqual(["0123456"]);
    expect(view.all(".push")).toHaveLength(0);
  });

  it("names nothing for a detached HEAD with no commit yet", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status([], null, { branch: null, head: null }).toJson() });

    expect(view.texts(".branch")).toEqual([""]);
  });

  it("pulls beside Push, naming what is behind, and sends the status it is based on", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.pull": null, "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 0, 3, false)).toJson() });

    const shown: readonly string[] = view.texts(".line .nol-button-label");
    await view.clickAsync(".pull");

    expect(shown).toEqual(["Pull 3", "Push"]);
    expect(view.requested("git.pull")).toEqual([{ folder: GitFixtures.folder, basedOn: "f1" }]);
  });

  it("offers Pull with nothing behind, since a pull fetches first", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 0, 0, false)).toJson() });

    expect([view.texts(".pull .nol-button-label"), view.find<HTMLButtonElement>(".pull").disabled]).toEqual([["Pull"], false]);
  });

  it.each([
    ["without an upstream", GitFixtures.status()],
    ["on a detached HEAD", GitFixtures.status([], new StatusUpstream("origin/main", 0, 2, false), { branch: null })]
  ])("shows no Pull %s", async (_case, status) => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": status.toJson() });

    expect(view.all(".pull")).toHaveLength(0);
  });

  it.each([
    ["the pointer", (pull: HTMLButtonElement): void => {
      pull.dispatchEvent(new PointerEvent("pointerenter"));
    }],
    ["focus", (pull: HTMLButtonElement): void => pull.focus()]
  ])("names the hooks a pull runs in Pull's tooltip, read once when %s reaches it", async (_case, reach) => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 0, 1, false)).toJson(),
      "git.pullHooks": new GitHooks(["post-merge", "reference-transaction"]).toJson()
    });
    const pull: HTMLButtonElement = view.find<HTMLButtonElement>(".pull");
    const description = (): string => (pull.getAttribute("aria-describedby") ?? "").split(" ").map(t => document.getElementById(t)?.textContent ?? "").join(" ").trim();

    const before: string = description();
    reach(pull);
    await GitFixtures.untilAsync(() => view.state.pullHooks() !== null);
    await view.fixture.whenStable();
    const loaded: string = description();
    pull.blur();
    reach(pull);
    await view.fixture.whenStable();

    expect([before, loaded]).toEqual([
      "Fetches and fast-forwards only, running the repository's hooks", "Fetches and fast-forwards only. Hooks that will run: post-merge, reference-transaction"
    ]);
    expect(view.requested("git.pullHooks")).toEqual([{ folder: GitFixtures.folder }]);
  });

  it("disables Pull when the upstream is gone", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status([], new StatusUpstream("origin/old", 0, 0, true)).toJson() });

    expect(view.find<HTMLButtonElement>(".pull").disabled).toBe(true);
  });

  it("opens the branch menu from the name with its field focused, marks the current branch, lists local and remote branches, filters them, and switches", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.switchBranch": null, "git.status": GitFixtures.status().toJson(), "git.branches": branches });

    await view.clickAsync(".name");
    await view.waitForAsync(".menu [role=option]");
    const opened: readonly unknown[] = [
      view.find(".name").getAttribute("aria-expanded"), document.activeElement === view.find(".filter"), view.texts(".menu .item .title"), view.texts(".menu .label"),
      view.all(".menu .separator").length, view.texts(".menu .item.current .title")
    ];
    await typeAsync(view, "LONG");
    const filtered: readonly string[] = view.texts(".menu .item .title");
    view.all(".menu .item")[1]?.click();
    await view.fixture.whenStable();

    expect(opened).toEqual([
      "true", true, ["Create branch from here…", "main", "sample-branch", "release", "origin/sample/4321-long-branch"], ["Local branches", "Remote branches"], 1, ["main"]
    ]);
    expect(filtered).toEqual(["Create branch LONG", "origin/sample/4321-long-branch"]);
    expect(view.requested("git.switchBranch")).toEqual([{ folder: GitFixtures.folder, name: "sample/4321-long-branch", basedOn: "f1" }]);
    expect(view.all(".menu")).toHaveLength(0);
  });

  it("starts on the current branch, moves through the menu with the arrow keys, wrapping at its ends, and chooses with Enter, giving focus back to the name", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.switchBranch": null, "git.status": GitFixtures.status().toJson(), "git.branches": branches });
    const press = async (key: string): Promise<void> => {
      view.find(".filter").dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      await view.fixture.whenStable();
    };
    const activeTitle = (): readonly string[] => view.texts(".menu .item.active .title");

    await view.clickAsync(".name");
    await view.waitForAsync(".menu [role=option]");
    const first: readonly string[] = activeTitle();
    await press("ArrowUp");
    const create: readonly string[] = activeTitle();
    await press("ArrowUp");
    const wrapped: readonly string[] = activeTitle();
    await press("ArrowDown");
    await press("ArrowDown");
    await press("ArrowDown");
    const third: readonly [readonly string[], string | null] = [activeTitle(), view.find(".filter").getAttribute("aria-activedescendant")];
    await press("a");
    await press("Enter");

    expect([first, create, wrapped, third]).toEqual([["main"], ["Create branch from here…"], ["origin/sample/4321-long-branch"], [["sample-branch"], "git-branch-option-2"]]);
    expect(view.requested("git.switchBranch")).toEqual([{ folder: GitFixtures.folder, name: "sample-branch", basedOn: "f1" }]);
    expect([view.all(".menu").length, document.activeElement === view.find(".name")]).toEqual([0, true]);
  });

  it("gives focus back to the name after a click chooses a branch, and marks the name aria-disabled while a write runs, ignoring clicks", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.branches": branches });
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.switchBranch"], { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.branches": branches });
    const switched = vi.spyOn(view.state, "switchBranchAsync");
    const name: HTMLElement = view.find(".name");

    await view.clickAsync(".name");
    await view.waitForAsync(".menu [role=option]");
    view.all(".menu .item")[2]?.click();
    await view.fixture.whenStable();
    const whileBusy: readonly unknown[] = [document.activeElement === name, name.getAttribute("aria-disabled"), name.hasAttribute("disabled")];
    await view.clickAsync(".name");
    const openedWhileBusy: number = view.all(".menu").length;
    await held.answerAsync("git.switchBranch", null);
    await switched.mock.results[0]?.value;
    await view.fixture.whenStable();

    expect([whileBusy, openedWhileBusy, name.getAttribute("aria-disabled")]).toEqual([[true, "true", false], 0, "false"]);
  });

  it("closes the menu when focus leaves the card, keeps it open while focus stays in the card, and closes it on Escape from anywhere in the card", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 1, 0, false)).toJson(), "git.branches": branches });
    const leave = async (from: Element, to: Element | null): Promise<void> => {
      from.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: to }));
      await view.fixture.whenStable();
    };
    const escape = async (from: Element): Promise<boolean> => {
      const event: KeyboardEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      from.dispatchEvent(event);
      await view.fixture.whenStable();
      return event.defaultPrevented;
    };
    const push: HTMLElement = view.find(".push");

    await view.clickAsync(".name");
    await view.waitForAsync(".filter");
    await leave(view.find(".filter"), document.body);
    const afterLeaving: number = view.all(".menu").length;
    await leave(push, document.body);
    await view.clickAsync(".name");
    await view.waitForAsync(".filter");
    await leave(view.find(".filter"), push);
    const afterMovingInside: number = view.all(".menu").length;
    const handled: boolean = await escape(push);
    const afterEscape: readonly [number, boolean] = [view.all(".menu").length, document.activeElement === view.find(".name")];
    push.focus();
    await escape(push);

    expect([afterLeaving, afterMovingInside, handled, afterEscape]).toEqual([0, 1, true, [0, true]]);
    expect([view.all(".menu").length, document.activeElement === push]).toEqual([0, true]);
  });

  it("keeps the menu open on the empty create row, creates a branch from the typed name, and does nothing for the current branch", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.createBranch": null, "git.status": GitFixtures.status().toJson(), "git.branches": branches });

    await view.clickAsync(".name");
    await view.waitForAsync(".menu [role=option]");
    view.all(".menu .item")[0]?.click();
    await view.fixture.whenStable();
    const stillOpen: number = view.all(".menu").length;
    view.all(".menu .item")[1]?.click();
    await view.fixture.whenStable();
    await view.clickAsync(".name");
    await view.waitForAsync(".menu [role=option]");
    await typeAsync(view, " feature/new ");
    view.all(".menu .item")[0]?.click();
    await view.fixture.whenStable();

    expect(stillOpen).toBe(1);
    expect(view.requested("git.switchBranch")).toEqual([]);
    expect(view.requested("git.createBranch")).toEqual([{ folder: GitFixtures.folder, name: "feature/new", basedOn: "f1" }]);
  });

  it("closes the menu on Escape, returning focus to the name, on a click outside, and from the name again", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.branches": branches });
    const name: HTMLElement = view.find(".name");

    await view.clickAsync(".name");
    await view.waitForAsync(".filter");
    view.find(".filter").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await view.fixture.whenStable();
    const afterEscape: readonly [number, boolean] = [view.all(".menu").length, document.activeElement === name];
    await view.clickAsync(".name");
    view.find(".menu").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    await view.fixture.whenStable();
    const afterOutside: number = view.all(".menu").length;
    await view.clickAsync(".name");
    await view.clickAsync(".name");

    expect([afterEscape, afterOutside, view.all(".menu").length]).toEqual([[0, true], 0, 0]);
  });

  it("shows only the field until the branches load, and ignores the arrow keys and Enter meanwhile", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.branches"], { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });

    await view.clickAsync(".name");
    await view.waitForAsync(".filter");
    for (const key of ["ArrowDown", "Enter"])
      view.find(".filter").dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    await view.fixture.whenStable();
    const before: readonly [number, number, string | null] = [view.all(".menu [role=option]").length, view.all(".menu").length, view.find(".filter").getAttribute("aria-activedescendant")];
    await held.answerAsync("git.branches", branches);
    await GitFixtures.untilAsync(() => view.state.branches() !== null);
    await view.fixture.whenStable();

    expect(before).toEqual([0, 1, null]);
    expect(view.all(".menu [role=option]")).toHaveLength(5);
  });

  it("cuts a long branch name, and a long branch in the menu, with an ellipsis, and shows each whole in a tooltip", async () => {
    const long: string = "sample/1234-a-branch-whose-name-is-far-too-long-for-the-card-to-show-whole";
    const remote: string = `origin/${long}-on-the-remote`;
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
    onTestFinished(() => AppearanceFixture.reset());
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([], null, { branch: long }).toJson(), "git.branches": GitFixtures.branches(long, [long, "main"], [remote]).toJson()
    }, ".body", [TooltipFixture.atOnce]);
    onTestFinished(async () => (await AppearanceFixture.parkPointerAsync()).remove());
    view.element.style.width = "25rem";
    view.element.style.height = "40rem";
    await view.fixture.whenStable();
    const tooltipAsync = async (target: HTMLElement, text: string): Promise<string> => {
      await PointerFixture.hoverAsync(target);
      const shown = (): string => document.querySelector("nol-tooltip")?.textContent?.trim() ?? "";
      await view.untilAsync(() => shown() === text);
      return shown();
    };

    const branch: HTMLElement = view.find(".branch");
    AppearanceFixture.expectTruncates(branch);
    const shownName: string = await tooltipAsync(branch, long);
    await view.clickAsync(".name");
    await view.waitForAsync(".menu [role=option]");
    await view.fixture.whenStable();
    const title: HTMLElement = view.all(".menu .item .title").find(t => t.textContent === remote) ?? view.find(".menu");
    AppearanceFixture.expectTruncates(title);
    const shownTitle: string = await tooltipAsync(title, remote);

    expect([shownName, shownTitle, view.find(".name").getAttribute("aria-label")?.includes(long)]).toEqual([long, remote, true]);
  });
});
