/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { FailureCode, GitBranchTrack, GitCode, GitRemote, GitRepositoryItems, GitStash, GitSubmodule, GitTag, GitWorktrees, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitRepositoryComponent } from "../../../../src/app/components/git-repository/git-repository.component.ts";
import { GitAgentState } from "../../../../src/app/enums/git-agent-state.ts";
import { GitAgentRow } from "../../../../src/app/models/git-agent-row.ts";
import type { GitBranchView } from "../../../../src/app/models/git-branch-view.ts";
import { GitRepositoryLink } from "../../../../src/app/models/git-repository-link.ts";
import { GitPullRequestList } from "../../../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../../../src/app/models/git-pull-request-row.ts";
import { GitAgents } from "../../../../src/app/services/git-agents.ts";
import { GitPullRequests } from "../../../../src/app/services/git-pull-requests.ts";
import { GitRepositoryLinks } from "../../../../src/app/services/git-repository-links.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";

class RenderedRepository {
  public readonly element: HTMLElement;
  public readonly requests: GitHeldRequests;
  public readonly context: FakeWindowPartContext;
  public readonly fixture: ComponentFixture<GitRepositoryComponent>;

  public constructor(element: HTMLElement, requests: GitHeldRequests, context: FakeWindowPartContext, fixture: ComponentFixture<GitRepositoryComponent>) {
    this.element = element;
    this.requests = requests;
    this.context = context;
    this.fixture = fixture;
  }
}

class RenderedPanel {
  public readonly element: HTMLElement;
  public readonly context: FakeWindowPartContext;

  public constructor(element: HTMLElement, context: FakeWindowPartContext) {
    this.element = element;
    this.context = context;
  }
}

describe("GitRepositoryComponent", () => {
  const answers: Readonly<Record<string, JsonValue>> = {
    ...GitFixtures.watching,
    "git.status": GitFixtures.status().toJson(),
    "git.branches": GitFixtures.branches("main", ["feature", "main"]).toJson(),
    "git.worktrees": new GitWorktrees([]).toJson(),
    "git.repositoryItems": new GitRepositoryItems([], [], [], false).toJson(),
    "git.remoteTracks": { tracks: [] }
  };

  const domAsync = (done: () => boolean): Promise<void> => {
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
  };

  const renderAsync = async (held: readonly string[], refusal: Error, remoteBranches: readonly string[] = [], localBranches: readonly string[] = ["feature", "main"]):
    Promise<RenderedRepository> => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: GitHeldRequests = new GitHeldRequests(context, held, {
      ...answers, "git.switchBranch": refusal, "git.branches": GitFixtures.branches("main", localBranches, remoteBranches).toJson()
    });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await domAsync(() => !Object.isNull(element.querySelector("button[title=feature]")));
    return new RenderedRepository(element, requests, context, fixture);
  };

  const currentOf = (element: HTMLElement): readonly string[] =>
    [...element.querySelectorAll(".row .current, .row .current ~ .strong")].map(t => (t.textContent ?? "").trim());

  it("shows the target branch with a spinner while Git switches, then the old branch and Git's reason when Git refuses", async () => {
    const { element, requests } = await renderAsync(["git.switchBranch"], new Error("unused"));
    const before: readonly string[] = currentOf(element);

    element.querySelector<HTMLElement>("button[title=feature]")?.dispatchEvent(new MouseEvent("dblclick"));
    await domAsync(() => currentOf(element)[1] === "feature");
    const during: readonly unknown[] = [currentOf(element), element.querySelector(".spin")?.getAttribute("aria-label") ?? null];
    await requests.answerAsync("git.switchBranch",
      GitFixtures.failure(FailureCode.Git, GitCode.ChangesInTheWay, "Your local changes to package-lock.json would be overwritten by checkout."));
    await domAsync(() => !Object.isNull(element.querySelector("[role=alert]")) && Object.isNull(element.querySelector(".spin")));

    expect([before, during, currentOf(element)]).toEqual([["check", "main"], [["progress_activity", "feature"], "Switching"], ["check", "main"]]);
    expect((element.querySelector("[role=alert]")?.textContent ?? "").trim()).toBe("Your local changes to package-lock.json would be overwritten by checkout.");
    expect(element.querySelector<HTMLButtonElement>("button[title=feature]")?.disabled).toBe(false);
  });

  it("puts the old branch back and says why when a hook refuses the switch", async () => {
    const { element } = await renderAsync([], GitFixtures.failure(FailureCode.Git, GitCode.HookFailed, "The post-checkout hook refused."));

    element.querySelector<HTMLElement>("button[title=feature]")?.dispatchEvent(new MouseEvent("dblclick"));
    await domAsync(() => !Object.isNull(element.querySelector("[role=alert]")) && Object.isNull(element.querySelector(".spin")));

    expect(currentOf(element)).toEqual(["check", "main"]);
    expect((element.querySelector("[role=alert]")?.textContent ?? "").trim()).toBe("The post-checkout hook refused.");
  });

  it("opens a remote, a level in from its section like a local branch, into its folders and branches, each level stepping in by an icon and its gap, and closes it again", async () => {
    const { element } = await renderAsync([], new Error("unused"), ["origin/main", "origin/team/a", "origin/team/b"]);
    const click = (selector: string): void => {
      const target: HTMLElement | null = element.querySelector<HTMLElement>(selector);
      if (Object.isNull(target))
        throw new Error(`Nothing matches ${selector}.`);
      target.click();
    };
    const remoteRows = (): HTMLElement[] => [...element.querySelectorAll<HTMLElement>("[title^='origin/']")];
    const textOf = (row: HTMLElement): string => [...row.children].map(t => (t.textContent ?? "").trim()).filter(t => t.length > 0).join(" ");
    const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);

    [...element.querySelectorAll<HTMLElement>("button.toggle")].find(t => t.textContent?.includes("Remotes"))?.click();
    await domAsync(() => remoteRows().length === 1);
    const closed: readonly string[] = remoteRows().map(textOf);
    click("[title='origin/']");
    await domAsync(() => remoteRows().length === 3);
    click("[title='origin/team/']");
    await domAsync(() => remoteRows().length === 5);
    const rows: HTMLElement[] = remoteRows();
    const opened: readonly string[] = rows.map(textOf);
    const insets: readonly number[] = rows.map(t => rem((t.querySelector(".ms, .octicon")?.getBoundingClientRect().left ?? 0) - t.getBoundingClientRect().left));
    const expanded: readonly (string | null)[] = rows.map(t => t.getAttribute("aria-expanded"));
    click("[title='origin/']");
    await domAsync(() => remoteRows().length === 1);

    expect(closed).toEqual(["chevron_right cloud origin 3"]);
    expect(opened).toEqual(["keyboard_arrow_down cloud origin 3", "keyboard_arrow_down folder team", "a", "b", "main"]);
    expect(insets).toEqual([1.875, 3.25, 4.625, 4.625, 3.25]);
    expect(expanded).toEqual(["true", "true", null, null, null]);
  });

  it("puts the folder icon, the name and the fetch button on one line and the path under the name", async () => {
    const { element } = await renderAsync([], new Error("unused"));
    const head: HTMLElement | null = element.querySelector<HTMLElement>(".row.head");
    const boxOf = (selector: string): DOMRect => head?.querySelector(selector)?.getBoundingClientRect() ?? new DOMRect();
    const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
    const icon: DOMRect = boxOf(":scope > .ms");
    const name: DOMRect = boxOf(".name");
    const button: DOMRect = boxOf("button");
    const path: DOMRect = boxOf(".path");
    const middle = (box: DOMRect): number => rem(box.top + box.height / 2);

    expect(icon.height).toBeGreaterThan(0);
    expect([middle(name) - middle(icon), middle(button) - middle(icon)].map(t => Math.abs(t) < 0.0625)).toEqual([true, true]);
    expect(rem(path.top - name.bottom)).toBeGreaterThanOrEqual(0);
    expect(rem(path.left - name.left)).toBe(0);
    expect(rem(path.left - (head?.getBoundingClientRect().left ?? 0))).toBe(1.875);
  });

  it("counts the tags, stashes and submodules, and lists each one when its section opens", async () => {
    const id: string = "0123456789abcdef0123456789abcdef01234567";
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new GitHeldRequests(context, [], {
      ...answers,
      "git.repositoryItems": new GitRepositoryItems([new GitTag("v2", id), new GitTag("v1", id)], [new GitStash(0, "On main: tidy", id)], [new GitSubmodule("vendor/lib", id)], false)
        .toJson()
    });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const sections = (): readonly string[] => [...element.querySelectorAll(".row:has(> .toggle)")]
      .map(t => [...t.querySelectorAll(".caps, .small")].map(u => (u.textContent ?? "").trim()).join(" "));
    await domAsync(() => sections().includes("Tags 2"));
    const counts: readonly string[] = sections().filter(t => /^(Tags|Stashes|Submodules)/u.test(t));
    for (const label of ["Tags", "Stashes", "Submodules"])
      [...element.querySelectorAll<HTMLElement>(".toggle")].find(t => (t.textContent ?? "").includes(label))?.click();
    await domAsync(() => element.querySelectorAll(".row.nested[title]").length >= 4);

    expect(counts).toEqual(["Tags 2", "Stashes 1", "Submodules 1"]);
    expect([...element.querySelectorAll(".row.nested[title]")].map(t => t.getAttribute("title")).filter(t => ["v2", "v1", "On main: tidy", "vendor/lib"].includes(t ?? "")))
      .toEqual(["v2", "v1", "On main: tidy", "vendor/lib"]);
  });

  it("shows a tag's commit in History on its click, its row selected until another row is, as a branch's is", async () => {
    const tagged: string = "0123456789abcdef0123456789abcdef01234567";
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new GitHeldRequests(context, [], {
      ...answers,
      "git.repositoryItems": new GitRepositoryItems([new GitTag("v2", tagged), new GitTag("v1", "f".repeat(40))], [], [], false).toJson()
    });
    GitFixtures.setUp(context);
    context.allow("openDocument");
    const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const tags = (): HTMLElement[] => [...element.querySelectorAll<HTMLElement>(".row.nested")].filter(t => ["v2", "v1"].includes(t.getAttribute("title") ?? ""));
    await domAsync(() => [...element.querySelectorAll<HTMLElement>(".toggle")].some(t => (t.textContent ?? "").includes("Tags")));
    [...element.querySelectorAll<HTMLElement>(".toggle")].find(t => (t.textContent ?? "").includes("Tags"))?.click();
    await domAsync(() => tags().length === 2);
    const looks = (): readonly unknown[] => tags().map(t => [t.tagName, t.classList.contains("sel"), t.getAttribute("aria-current")]);
    const before: readonly unknown[] = looks();
    tags()[0]?.click();
    await fixture.whenStable();
    const view: GitBranchView | null = GitViewing.branchOf(GitFixtures.folder);

    expect([before, looks(), view?.commitId, view?.branch, context.callsOf("openDocument").at(-1)?.[0]]).toEqual([
      [["BUTTON", false, null], ["BUTTON", false, null]], [["BUTTON", true, "true"], ["BUTTON", false, null]], tagged, "", "git.history"]);
  });

  it("shows each local branch's commits ahead and behind its upstream, the current branch's from the status", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...answers,
      "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 2, 1, false)).toJson(),
      "git.branches": GitFixtures.branches("main", ["feature", "fix", "main", "old"], [],
        [new GitBranchTrack("feature", 3, 0), new GitBranchTrack("fix", 0, 4), new GitBranchTrack("main", 9, 9)]).toJson()
    });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await domAsync(() => !Object.isNull(element.querySelector("button[title=main] .small")));

    expect(["feature", "fix", "main", "old"].map(t => [...element.querySelectorAll(`button[title=${t}] .small`)].map(u => u.textContent).join(" ")))
      .toEqual(["↑3", "↓4", "↑2 ↓1", ""]);
    expect([...element.querySelectorAll("button[title=main] .count")].map(t => t.getAttribute("title"))).toEqual(["2 commits to push", "1 commit to pull"]);
  });

  it.each(AppearanceFixture.modes)("colours a branch's counts, arrow and number alike, green to push and blue to pull, with remote branches' counts named against the current branch, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    onTestFinished(() => AppearanceFixture.reset());
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, {
      ...answers,
      "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 1, 2, false)).toJson(),
      "git.branches": GitFixtures.branches("main", ["feature", "main"], ["origin/main"]).toJson(),
      "git.remoteTracks": { tracks: [new GitBranchTrack("origin/main", 1, 3).toJson()] }
    });
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await domAsync(() => !Object.isNull(element.querySelector("button[title=main] .count.behind")));
    const resolve = (color: string): string => {
      const probe: HTMLSpanElement = document.createElement("span");
      probe.style.color = color;
      document.body.append(probe);
      const resolved: string = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    };
    const colorOf = (selector: string): string => getComputedStyle(element.querySelector(selector) ?? element).color;
    [...element.querySelectorAll<HTMLElement>("button.toggle")].find(t => t.textContent?.includes("Remotes"))?.click();
    await domAsync(() => !Object.isNull(element.querySelector("[title='origin/']")));
    element.querySelector<HTMLElement>("[title='origin/']")?.click();
    await domAsync(() => !Object.isNull(element.querySelector("[title='origin/main'] .count.behind")));
    const remote: readonly (string | null)[] = [...element.querySelectorAll("[title='origin/main'] .count")].map(t => t.getAttribute("title"));

    expect([colorOf("button[title=main] .ahead .arrow"), colorOf("button[title=main] .behind .arrow"), colorOf("button[title=main] .ahead"), colorOf("button[title=main] .behind")])
      .toEqual([resolve("var(--nol-status-ok)"), resolve("var(--nol-accent)"), resolve("var(--nol-status-ok)"), resolve("var(--nol-accent)")]);
    expect(resolve("var(--nol-status-ok)")).not.toBe(resolve("var(--nol-accent)"));
    expect(remote).toEqual(["1 commit your branch doesn't have", "3 commits on your branch it doesn't have"]);
    expect([...element.querySelectorAll("button[title=main] .count")].map(t => t.getAttribute("title"))).toEqual(["1 commit to push", "2 commits to pull"]);
  });

  it("asks a new branch's name from the side panel's new branch button, creates it on the status it read, and creates none when cancelled", async () => {
    const { element, requests, context, fixture } = await renderAsync(["git.createBranch"], new Error("unused"));
    const dialog = (): HTMLElement | null => document.querySelector("nol-git-bulk-branch-dialog");
    const part = <T extends HTMLElement>(selector: string): T => {
      const found: T | null | undefined = dialog()?.querySelector<T>(selector);
      if (Object.isNullOrUndefined(found))
        throw new Error(`The dialog has no ${selector}.`);
      return found;
    };
    const created = (): readonly unknown[] => context.callsOf("requestAsync").filter(t => t[0] === "git.createBranch").map(t => t[1]);
    const newBranch: HTMLButtonElement = element.querySelector<HTMLButtonElement>(".new-branch") ?? document.createElement("button");

    newBranch.click();
    await domAsync(() => !Object.isNull(dialog()));
    part<HTMLButtonElement>(".cancel").click();
    await domAsync(() => Object.isNull(dialog()));
    const cancelled: readonly unknown[] = created();
    newBranch.click();
    await domAsync(() => !Object.isNull(dialog()));
    await fixture.whenStable();
    const field: HTMLInputElement = part<HTMLInputElement>(".name");
    field.value = "feature/kit";
    field.dispatchEvent(new Event("input"));
    await domAsync(() => !part<HTMLButtonElement>(".create").disabled);
    part<HTMLButtonElement>(".create").click();
    await requests.answerAsync("git.createBranch", null);

    expect([newBranch.disabled, cancelled]).toEqual([false, []]);
    expect(created()).toEqual([{ folder: GitFixtures.folder, name: "feature/kit", basedOn: "f1" }]);
  });

  it("fetches every remote from Fetch all on the status it read, holding the button while the fetch runs", async () => {
    const { element, requests, context } = await renderAsync(["git.fetch"], new Error("unused"));
    const fetchAll: HTMLButtonElement = element.querySelector<HTMLButtonElement>(".fetch-all") ?? document.createElement("button");
    const before: readonly unknown[] = [fetchAll.disabled, fetchAll.getAttribute("aria-label")];

    fetchAll.click();
    const settle = await requests.nextAsync("git.fetch");
    await domAsync(() => fetchAll.disabled);
    settle(null);
    await domAsync(() => !fetchAll.disabled);

    expect(before).toEqual([false, "Fetch all"]);
    expect(context.callsOf("requestAsync").filter(t => t[0] === "git.fetch").map(t => t[1])).toEqual([{ folder: GitFixtures.folder, basedOn: "f1", allRemotes: true }]);
  });

  it("reads no folder again after a write once the panel has moved on, so the folder it moved to keeps its own read", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: GitHeldRequests = new GitHeldRequests(context, ["git.fetch"], { ...answers, "git.branches": GitFixtures.branches("main", ["feature", "main"]).toJson() });
    const folder: WritableSignal<string | null> = GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await domAsync(() => !Object.isNull(element.querySelector("button[title=feature]")));
    const statusReadsOf = (read: string): number => context.callsOf("requestAsync").filter(t => t[0] === "git.status" && JSON.stringify(t[1]) === JSON.stringify({ folder: read })).length;
    const other: string = "/work/other";

    element.querySelector<HTMLButtonElement>(".fetch-all")?.click();
    const settle = await requests.nextAsync("git.fetch");
    folder.set(other);
    await domAsync(() => statusReadsOf(other) === 1);
    const before: number = statusReadsOf(GitFixtures.folder);
    settle(null);
    await domAsync(() => !(element.querySelector<HTMLButtonElement>(".fetch-all")?.disabled ?? true));
    await fixture.whenStable();

    expect([statusReadsOf(GitFixtures.folder) - before, statusReadsOf(other)]).toEqual([0, 1]);
  });

  it("paints no background of its own, so it shows the side panel's, as the Git panel does", async () => {
    const { element } = await renderAsync([], new Error("unused"));

    expect(getComputedStyle(element).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });

  it("puts local branches a level in from their section, in folders, folders first, each level stepping in, draws the branch icon at the icons' size, and switches to a branch inside one by its whole name, keeping the current branch in its place", async () => {
    const { element } = await renderAsync(["git.switchBranch"], new Error("unused"), [], ["main", "feature", "team/a", "team/deep/x"]);
    const localRows = (): HTMLElement[] => [...element.querySelectorAll<HTMLElement>("button.row[style*='padding-left']")]
      .filter(t => !(t.getAttribute("title") ?? "").startsWith("origin/") && Object.isNull(t.querySelector(".current")));
    const textOf = (row: HTMLElement): string => [...row.children].map(t => (t.textContent ?? "").trim()).filter(t => t.length > 0).join(" ");
    const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
    const titles = (): readonly (string | null)[] => [...element.querySelectorAll<HTMLElement>("button.row[style*='padding-left']")]
      .map(t => t.getAttribute("title")).filter(t => !(t ?? "").startsWith("origin/"));

    const closed: readonly string[] = localRows().map(textOf);
    element.querySelector<HTMLElement>("[title='team/']")?.click();
    await domAsync(() => localRows().length === 4);
    const rows: HTMLElement[] = localRows();
    const opened: readonly string[] = rows.map(textOf);
    const insets: readonly number[] = rows.map(t => rem((t.querySelector(".ms, .octicon")?.getBoundingClientRect().left ?? 0) - t.getBoundingClientRect().left));
    const current: HTMLElement | null = element.querySelector<HTMLElement>("[title=main]");
    const currentInset: number = rem((current?.querySelector(".current")?.getBoundingClientRect().left ?? 0) - (current?.getBoundingClientRect().left ?? 0));
    const iconHeight: number = rem(rows[3]?.querySelector(".octicon path")?.getBoundingClientRect().height ?? 0);
    element.querySelector<HTMLElement>("[title='team/a']")?.dispatchEvent(new MouseEvent("dblclick"));
    const before: readonly (string | null)[] = titles();
    await domAsync(() => currentOf(element)[1] === "a");

    expect(closed).toEqual(["chevron_right folder team", "feature"]);
    expect(opened).toEqual(["keyboard_arrow_down folder team", "chevron_right folder deep", "a", "feature"]);
    expect(insets).toEqual([1.875, 3.25, 3.25, 1.875]);
    expect(currentInset).toBe(1.875);
    expect([before, titles()]).toEqual([["team/", "team/deep/", "team/a", "feature", "main"], ["team/", "team/deep/", "team/a", "feature", "main"]]);
    expect(iconHeight).toBeLessThan(0.75);
    expect(rows.map(t => t.getAttribute("aria-expanded"))).toEqual(["true", "false", null, null]);
  });

  describe("its branch and tag menus", () => {
    const id: string = "0123456789abcdef0123456789abcdef01234567";

    const renderWithAsync = async (extra: Readonly<Record<string, JsonValue | Error>>): Promise<RenderedPanel> => {
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      new GitHeldRequests(context, [], { ...answers, "git.repositoryItems": new GitRepositoryItems([new GitTag("v1", id)], [], [], false).toJson(), ...extra });
      GitFixtures.setUp(context);
      const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
      fixture.autoDetectChanges();
      const element: HTMLElement = fixture.nativeElement;
      await domAsync(() => !Object.isNull(element.querySelector("button[title=feature]")));
      return new RenderedPanel(element, context);
    };
    const menuOf = async (row: HTMLElement): Promise<readonly HTMLButtonElement[]> => {
      const box: DOMRect = row.getBoundingClientRect();
      row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: box.left + 4, clientY: box.top + 4, button: 2 }));
      await domAsync(() => !Object.isNull(document.querySelector("[nol-menu-item]")));
      return [...document.querySelectorAll<HTMLButtonElement>("[nol-menu-item]")];
    };
    const choose = async (row: HTMLElement, label: string): Promise<void> => {
      (await menuOf(row)).find(t => (t.textContent ?? "").includes(label))?.click();
      await domAsync(() => Object.isNull(document.querySelector("[nol-menu-item]")));
    };
    const isOff = (item: HTMLButtonElement): boolean => item.disabled || item.getAttribute("aria-disabled") === "true";
    const requested = (context: FakeWindowPartContext, method: string): readonly unknown[] =>
      context.callsOf("requestAsync").filter(t => t[0] === method).map(t => t[1]);
    const typeInto = (field: HTMLInputElement | null, text: string): void => {
      if (Object.isNull(field))
        return;
      field.value = text;
      field.dispatchEvent(new Event("input"));
    };

    it("offers switching, renaming and deleting a branch, but neither switching to nor deleting the current one, and deletes another", async () => {
      const { element, context } = await renderWithAsync({ "git.deleteBranch": null });
      const forMain: readonly boolean[] = (await menuOf(element.querySelector<HTMLElement>("button[title=main]") ?? element)).map(isOff);
      document.querySelector("[nol-menu-item]")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
      await domAsync(() => Object.isNull(document.querySelector("[nol-menu-item]")));

      await choose(element.querySelector<HTMLElement>("button[title=feature]") ?? element, "Delete");
      await domAsync(() => requested(context, "git.deleteBranch").length === 1);

      expect(forMain).toEqual([true, false, true]);
      expect(requested(context, "git.deleteBranch")).toEqual([{ folder: GitFixtures.folder, name: "feature", basedOn: GitFixtures.status().fingerprint }]);
    });

    it("renames a branch in a field in its row, as wide as the row, and keeps the field with Git's refusal when the name is taken", async () => {
      const { element, context } = await renderWithAsync({
        "git.renameBranch": GitFixtures.failure(FailureCode.Refused, null, "The branch main already exists. Choose a new name.")
      });
      const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
      const row: HTMLElement = element.querySelector<HTMLElement>("button[title=feature]") ?? element;
      const rowBox: DOMRect = row.getBoundingClientRect();

      await choose(row, "Rename");
      await domAsync(() => !Object.isNull(element.querySelector(".rename input")));
      const form: DOMRect = element.querySelector(".rename")?.getBoundingClientRect() ?? new DOMRect();
      const field: HTMLInputElement | null = element.querySelector<HTMLInputElement>(".rename input");
      const fieldBox: DOMRect = field?.getBoundingClientRect() ?? new DOMRect();
      const shape: readonly unknown[] = [field?.value, field?.getAttribute("aria-label"), rem(form.left - rowBox.left), rem(form.width - rowBox.width),
        fieldBox.left > form.left, fieldBox.right <= form.right, fieldBox.bottom <= form.bottom];
      typeInto(field, "main");
      element.querySelector<HTMLFormElement>(".rename")?.requestSubmit();
      await domAsync(() => !Object.isNull(element.querySelector("[role=alert]")));

      expect(shape).toEqual(["feature", "New name for feature", 0, 0, true, true, true]);
      expect(requested(context, "git.renameBranch")).toEqual([{ folder: GitFixtures.folder, name: "feature", newName: "main", basedOn: GitFixtures.status().fingerprint }]);
      expect([(element.querySelector("[role=alert]")?.textContent ?? "").trim(), element.querySelectorAll(".rename input").length])
        .toEqual(["The branch main already exists. Choose a new name.", 1]);
    });

    it("renames a branch by its trimmed new name, closing the field, closes it without a request on Escape or an unchanged name, and keeps it for a blank one", async () => {
      const { element, context } = await renderWithAsync({ "git.renameBranch": null });
      const field = (): HTMLInputElement | null => element.querySelector<HTMLInputElement>(".rename input");
      const row = (): HTMLElement => element.querySelector<HTMLElement>("button[title=feature]") ?? element;
      const submit = (): void => element.querySelector<HTMLFormElement>(".rename")?.requestSubmit();

      await choose(row(), "Rename");
      await domAsync(() => !Object.isNull(field()));
      field()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await domAsync(() => Object.isNull(field()));
      await choose(row(), "Rename");
      await domAsync(() => !Object.isNull(field()));
      submit();
      await domAsync(() => Object.isNull(field()));
      await choose(row(), "Rename");
      await domAsync(() => !Object.isNull(field()));
      typeInto(field(), "  ");
      submit();
      const stayed: boolean = !Object.isNull(field());
      typeInto(field(), " topic ");
      submit();
      await domAsync(() => Object.isNull(field()) && requested(context, "git.renameBranch").length === 1);

      expect(stayed).toBe(true);
      expect(requested(context, "git.renameBranch")).toEqual([{ folder: GitFixtures.folder, name: "feature", newName: "topic", basedOn: GitFixtures.status().fingerprint }]);
    });

    it("deletes a tag from its row's menu", async () => {
      const { element, context } = await renderWithAsync({ "git.deleteTag": null });
      [...element.querySelectorAll<HTMLElement>(".toggle")].find(t => (t.textContent ?? "").includes("Tags"))?.click();
      await domAsync(() => !Object.isNull(element.querySelector(".row.nested[title=v1]")));

      await choose(element.querySelector<HTMLElement>(".row.nested[title=v1]") ?? element, "Delete");
      await domAsync(() => requested(context, "git.deleteTag").length === 1);

      expect(requested(context, "git.deleteTag")).toEqual([{ folder: GitFixtures.folder, name: "v1", basedOn: GitFixtures.status().fingerprint }]);
    });

    it("switches to a pull request's source branch from its menu, on the status the panel read, and offers no switch to the current branch's own", async () => {
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
      new GitHeldRequests(context, [], { ...answers, "git.status": GitFixtures.status([], null, { remote }).toJson(), "git.switchBranch": null });
      onTestFinished(GitPullRequests.provide(context, {
        claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "git-github.account",
        listFor: () => signal(GitPullRequestList.ready([
          new GitPullRequestRow("214", "#214", "Draw lanes", "https://github.com/example-owner/example-repository/pull/214", false, 0, 0, 0, 0, "feature/graph"),
          new GitPullRequestRow("215", "#215", "Tidy the garden", "https://github.com/example-owner/example-repository/pull/215", false, 0, 0, 0, 0, "main")
        ])),
        refresh: () => undefined
      }));
      GitFixtures.setUp(context);
      const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
      fixture.autoDetectChanges();
      const element: HTMLElement = fixture.nativeElement;
      await domAsync(() => element.querySelectorAll(".pull-request").length === 2 && !Object.isNull(element.querySelector("button[title=main]")));
      const rows: HTMLElement[] = [...element.querySelectorAll<HTMLElement>(".pull-request")];
      const forCurrent: boolean = isOff((await menuOf(rows[1] ?? element))[0] ?? document.createElement("button"));
      document.querySelector("[nol-menu-item]")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
      await domAsync(() => Object.isNull(document.querySelector("[nol-menu-item]")));

      await choose(rows[0] ?? element, "Switch to branch");
      await domAsync(() => requested(context, "git.switchBranch").length === 1);

      expect([forCurrent, requested(context, "git.switchBranch")]).toEqual([true, [{ folder: GitFixtures.folder, name: "feature/graph", basedOn: GitFixtures.status().fingerprint }]]);
    });
  });

  it("shows the agents' runs and the current branch's remote's pull requests after the branches and before the remotes, and no pull requests without a remote", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
    let hasRemote: boolean = true;
    GitFixtures.answerWith(context, { ...answers, "git.status": () => GitFixtures.status([], null, { remote: hasRemote ? remote : null, fingerprint: hasRemote ? "f1" : "f2" }).toJson() });
    onTestFinished(GitPullRequests.provide(context, {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "git-github.account",
      listFor: () => signal(GitPullRequestList.ready([new GitPullRequestRow("214", "#214", "Draw lanes on a canvas", "https://github.com/example-owner/example-repository/pull/214", false, 2, 1, 0, 0, "feature/graph")])),
      refresh: () => undefined
    }));
    onTestFinished(GitAgents.provide({ listFor: () => signal([new GitAgentRow("run-1", "Blame gutter", GitAgentState.Working, "/work/blame")]), open: () => undefined }));
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await domAsync(() => !Object.isNull(element.querySelector(".pull-request")));
    const sections: string[] = [...element.querySelectorAll(".caps")].map(t => (t.textContent ?? "").trim());

    hasRemote = false;
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await domAsync(() => Object.isNull(element.querySelector("nol-git-pull-requests")));

    expect(sections.slice(0, 4)).toEqual(["Branches", "Agents", "Pull requests", "Remotes"]);
  });

  const linkedAsync = async (remote: GitRemote | null, opened: string[], active: Signal<boolean> = signal(false)): Promise<HTMLElement> => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...answers, "git.status": GitFixtures.status([], null, { remote }).toJson() });
    onTestFinished(GitRepositoryLinks.provide({
      linksFor: t => t.host !== "dev.azure.com" ? [] : [new GitRepositoryLink("workItems", "Work items", "checklist", () => opened.push("workItems"), active),
        new GitRepositoryLink("sprint", "Sprint", "view_kanban", () => opened.push("sprint"))]
    }));
    GitFixtures.setUp(context);
    const fixture: ComponentFixture<GitRepositoryComponent> = TestBed.createComponent(GitRepositoryComponent);
    fixture.autoDetectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await domAsync(() => !Object.isNull(element.querySelector("button[title=feature]")));
    await fixture.whenStable();
    return element;
  };

  it("shows a host's rows for the repository's remote right under History, and each opens its page", async () => {
    const opened: string[] = [];
    const element: HTMLElement = await linkedAsync(new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https), opened);
    const rows: HTMLElement[] = [...element.querySelectorAll<HTMLElement>(".row.link")];

    rows[1]?.click();
    rows[0]?.click();

    expect([rows.map(t => [t.querySelector(".ms")?.textContent, t.querySelector(".grow")?.textContent]), element.querySelector(".row.history + .row.link") === rows[0], opened])
      .toEqual([[["checklist", "Work items"], ["view_kanban", "Sprint"]], true, ["sprint", "workItems"]]);
  });

  it("selects a host's row while its page is the active document, in place of Changes or History, and Changes again once it isn't", async () => {
    const active = signal(true);
    const element: HTMLElement = await linkedAsync(new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https), [], active);
    const selected = (): (string | null)[][] => [...element.querySelectorAll<HTMLElement>(".row.changes, .row.history, .row.link")]
      .map(t => [t.querySelector(".grow")?.textContent ?? null, t.classList.contains("sel") ? "sel" : null, t.getAttribute("aria-current")]);
    const whileActive = selected();
    active.set(false);
    await domAsync(() => !Object.isNull(element.querySelector(".row.changes.sel")));

    expect([whileActive, selected()]).toEqual([
      [["Changes", null, null], ["History", null, null], ["Work items", "sel", "true"], ["Sprint", null, null]],
      [["Changes", "sel", "true"], ["History", null, null], ["Work items", null, null], ["Sprint", null, null]]]);
  });

  it.each([["another host's remote", new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https)], ["no remote", null]])(
    "shows no host rows for %s", async (_, remote) => {
      const element: HTMLElement = await linkedAsync(remote, []);

      expect([element.querySelectorAll(".row.link").length, !Object.isNull(element.querySelector(".row.history"))]).toEqual([0, true]);
    });
});
