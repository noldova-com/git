/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import type { JsonValue } from "@noldova/context.json";
import { ShikiLineTokenizer } from "@noldova/editor.angular";
import { ConflictKind, FailureCode, FileState, GitDiff, GitJournal, LineCounts, LineKind, type StatusEntry } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { GitFileGroupComponent } from "../../../../src/app/components/git-file-group/git-file-group.component.ts";
import { GitFileLayout } from "../../../../src/app/enums/git-file-layout.ts";
import { GitDiffRow } from "../../../../src/app/models/git-diff-row.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitFileGroupComponent", () => {
  const entries = [
    GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified),
    GitFixtures.entry("src/b.ts", FileState.Modified, FileState.Unmodified, new LineCounts(12, 1)),
    GitFixtures.entry("docs/c.md", FileState.Unmodified, FileState.Modified, new LineCounts(4, 1)),
    GitFixtures.entry("d.ts", FileState.Untracked, FileState.Untracked, new LineCounts(9, 0)),
    GitFixtures.entry("e.png", FileState.Untracked, FileState.Untracked, null)
  ];

  it("draws each group's title and count, and each row's name, folder, counts or conflict kind, then its state", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status(entries).toJson() });
    view.state.fileLayout.set(GitFileLayout.List);
    await view.fixture.whenStable();

    expect(view.texts(".header .title, .header .count")).toEqual(["Conflicts", "1", "Staged", "1", "Changes", "3"]);
    expect(view.all("nol-git-file-group").map(t => [...t.querySelectorAll(".header > *")].map(u => ["title", "count", "spacer", "layout", "move-all"].find(c => u.classList.contains(c))))).toEqual([
      ["title", "count", "spacer", "layout"], ["title", "count", "spacer", "layout", "move-all"], ["title", "count", "spacer", "layout", "move-all"]
    ]);
    expect(view.all(".file .name").map(t => [...t.querySelectorAll(".state, .path, .kind, .counts")].map(u => u.textContent).join(" "))).toEqual([
      "a.ts Both changed !", "src/b.ts +12−1 M", "docs/c.md +4−1 M", "d.ts +9 U", "e.png U"
    ]);
    expect(view.all(".directory").map(t => t.textContent)).toEqual(["src/", "docs/"]);
    expect(view.all(".state").map(t => t.dataset["tone"])).toEqual(["Conflict", "Modified", "Modified", "Untracked", "Untracked"]);
  });

  it("shows every group by folder, then as a tree or a list from any group's menu, each folder's files a step in under its icon", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([
        ...["src/s.ts", "src/a.ts"].map(t => GitFixtures.entry(t, FileState.Modified, FileState.Unmodified)),
        ...["z.ts", "docs/c.md", "src/b.ts", "src/app/deep/d.ts"].map(t => GitFixtures.entry(t, FileState.Unmodified, FileState.Modified))
      ]).toJson()
    });
    const lines = (): readonly string[] => view.all(".files > li > .folder, .files > li > .file .path")
      .map(t => t.classList.contains("folder") ? [...t.children].map(u => u.textContent).join(" ") : t.textContent ?? "");
    const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
    const leftOf = (element: Element | null | undefined): number => element?.getBoundingClientRect().left ?? 0;
    const insetOf = (selector: string, inner: string): number => rem(leftOf(view.find(selector).querySelector(inner)) - leftOf(view.find(selector)));
    const icons = (): readonly string[] => view.texts(".layout button");

    await view.clickAsync("nol-git-file-group:nth-of-type(2) .more");
    const folders: readonly string[] = lines();
    const folderIcons: readonly string[] = icons();
    await view.chooseAsync("nol-git-file-group:nth-of-type(2) .layout button", "Tree");
    await view.untilAsync(() => lines().includes("expand_more folder app/deep"));
    const tree: readonly string[] = lines();
    const insets: readonly number[] = [
      insetOf("nol-git-file-group:nth-of-type(2) li:nth-child(3) .folder", ".material-symbols-rounded:nth-child(2)"),
      insetOf("nol-git-file-group:nth-of-type(2) li:nth-child(4) .folder", ".material-symbols-rounded:nth-child(2)"),
      insetOf("nol-git-file-group:nth-of-type(2) li:nth-child(5) .file", "nol-file-badge"),
      insetOf("nol-git-file-group:nth-of-type(2) li:nth-child(6) .file", "nol-file-badge")
    ];
    const treeIcons: readonly string[] = icons();
    await view.clickAsync("nol-git-file-group:nth-of-type(2) li:nth-child(3) .folder");
    const closed: readonly string[] = lines();
    await view.chooseAsync(".layout button", "List");

    expect(folders).toEqual(["expand_more folder src", "s.ts", "a.ts", "expand_more folder docs", "c.md", "expand_more folder src", "b.ts",
      "expand_more folder src/app/deep", "d.ts", "z.ts"]);
    expect(tree).toEqual(["expand_more folder src", "s.ts", "a.ts", "expand_more folder docs", "c.md", "expand_more folder src", "expand_more folder app/deep", "d.ts",
      "b.ts", "z.ts"]);
    expect(insets).toEqual([1.625, 3, 3, 1.625]);
    expect([folderIcons, treeIcons]).toEqual([["folder_open", "folder_open"], ["account_tree", "account_tree"]]);
    expect(view.all(".layout button").map(t => t.getAttribute("aria-label"))).toEqual(["Show files as", "Show files as"]);
    expect(closed).toEqual(["expand_more folder src", "s.ts", "a.ts", "expand_more folder docs", "c.md", "chevron_right folder src", "z.ts"]);
    expect(lines()).toEqual(["src/s.ts", "src/a.ts", "z.ts", "docs/c.md", "src/b.ts", "src/app/deep/d.ts"]);
  });

  it("stages and unstages a row or a whole group by its paths", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.stage": null, "git.unstage": null, "git.status": GitFixtures.status(entries).toJson() });
    const writes = [vi.spyOn(view.state, "stageAsync"), vi.spyOn(view.state, "unstageAsync")];
    const clickAsync = async (group: number, selector: string): Promise<void> => {
      view.find(`nol-git-file-group:nth-of-type(${group}) ${selector}`).click();
      await Promise.all(writes.flatMap(t => t.mock.results.map(u => u.value)));
      await view.fixture.whenStable();
    };

    await clickAsync(1, ".move");
    await clickAsync(2, ".move-all");
    await clickAsync(3, ".move-all");
    await clickAsync(2, ".move");

    const folder: string = GitFixtures.folder;
    expect(view.context.callsOf("requestAsync").filter(t => t[0] === "git.stage" || t[0] === "git.unstage")).toEqual([
      ["git.stage", { folder, paths: ["a.ts"], basedOn: "f1" }],
      ["git.unstage", { folder, paths: ["src/b.ts"], basedOn: "f1" }],
      ["git.stage", { folder, paths: ["docs/c.md", "d.ts", "e.png"], basedOn: "f1" }],
      ["git.unstage", { folder, paths: ["src/b.ts"], basedOn: "f1" }]
    ]);
  });

  it("discards a Changes row only after asking, saying an untracked file is deleted and a tracked one goes back to what is staged", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.discard": null, "git.journal": new GitJournal([]).toJson(), "git.status": GitFixtures.status(entries).toJson()
    });
    const discards = vi.spyOn(view.state, "discardAsync");
    const dialog = (): HTMLElement | null => document.querySelector("nol-git-discard-dialog");
    const askAsync = async (path: string): Promise<string> => {
      view.find(`nol-git-file-group:nth-of-type(3) .discard[aria-label="Discard changes to ${path}"]`).click();
      await view.untilAsync(() => (dialog()?.querySelector(".text")?.textContent ?? "") !== "");
      return [dialog()?.querySelector(".nol-dialog-title")?.textContent, dialog()?.querySelector(".text")?.textContent].join("|");
    };
    const answerAsync = async (selector: string): Promise<void> => {
      dialog()?.querySelector<HTMLElement>(selector)?.click();
      await view.untilAsync(() => dialog() === null);
      await Promise.all(discards.mock.results.map(t => t.value));
      await view.fixture.whenStable();
    };

    const untracked: string = await askAsync("d.ts");
    const focused: boolean = document.activeElement?.matches("nol-git-discard-dialog .cancel") ?? false;
    await answerAsync(".cancel");
    await askAsync("e.png");
    await userEvent.keyboard("{Escape}");
    await view.untilAsync(() => dialog() === null);
    const tracked: string = await askAsync("docs/c.md");
    await answerAsync(".discard");

    expect(view.all("nol-git-file-group").map(t => t.querySelectorAll(".discard").length)).toEqual([0, 0, 3]);
    expect([untracked, focused]).toEqual(["Discard changes?|d.ts isn't tracked, so discarding deletes it. This can't be undone.", true]);
    expect(tracked).toBe("Discard changes?|The changes to docs/c.md in the working folder will be lost, and it goes back to what is staged. This can't be undone.");
    expect(view.requested("git.discard")).toEqual([{ folder: GitFixtures.folder, paths: ["docs/c.md"], basedOn: "f1" }]);
  });

  it("says a discard can be undone while a checkpoint is kept first, and can't be when the journal can't be read", async () => {
    const journals: (JsonValue | Error)[] = [new GitJournal([], true).toJson(), GitFixtures.failure(FailureCode.Unavailable)];
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.journal": () => journals.shift() ?? null, "git.status": GitFixtures.status(entries).toJson()
    });
    const textOfAsync = async (): Promise<string> => {
      view.find("nol-git-file-group:nth-of-type(3) .discard").click();
      await view.untilAsync(() => (document.querySelector("nol-git-discard-dialog .text")?.textContent ?? "") !== "");
      const text: string = document.querySelector("nol-git-discard-dialog .text")?.textContent ?? "";
      document.querySelector<HTMLElement>("nol-git-discard-dialog .cancel")?.click();
      await view.untilAsync(() => document.querySelector("nol-git-discard-dialog") === null);
      return text;
    };

    const kept: string = await textOfAsync();
    const unread: string = await textOfAsync();

    expect([kept, unread]).toEqual([
      "The changes to docs/c.md in the working folder will be lost, and it goes back to what is staged. A checkpoint is kept, so you can undo it.",
      "The changes to docs/c.md in the working folder will be lost, and it goes back to what is staged. This can't be undone."
    ]);
  });

  it("opens a conflicted file's editor from its name by click or Enter, with no diff or expand button", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status(entries).toJson() });
    const conflict: HTMLElement = view.find("nol-git-file-group:nth-of-type(1) .file");
    const group: GitFileGroupComponent = view.fixture.debugElement.query(By.directive(GitFileGroupComponent)).injector.get(GitFileGroupComponent);
    const opened: string[] = [];
    const subscription = group.openConflict.subscribe(t => opened.push(t));
    onTestFinished(() => subscription.unsubscribe());
    const name: HTMLButtonElement = view.find<HTMLButtonElement>("nol-git-file-group:nth-of-type(1) .file .name");

    name.click();
    name.focus();
    await userEvent.keyboard("{Enter}");
    await view.fixture.whenStable();

    expect([name.localName, name.type, name.getAttribute("aria-expanded"), conflict.querySelector(".expand"), conflict.querySelector(".diff")]).toEqual(["button", "button", null, null, null]);
    expect([...conflict.querySelectorAll("button")].map(t => t.matches(".name") || t.matches(".move"))).toEqual([true, true]);
    expect(opened).toEqual(["a.ts", "a.ts"]);
    expect(view.requested("git.diff")).toEqual([]);
  });

  it("shows two files of a group of more than three and a row naming the rest, which shows them all", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status(["a.ts", "b.ts", "c.ts", "d.ts"].map(t => GitFixtures.entry(t, FileState.Unmodified, FileState.Modified))).toJson()
    });
    const names = (): readonly string[] => view.all(".file .path").map(t => t.textContent ?? "");

    const before: readonly [readonly string[], readonly string[]] = [names(), view.texts(".more")];
    await view.clickAsync(".more");

    expect(before).toEqual([["a.ts", "b.ts"], ["and two more"]]);
    expect([names(), view.all(".more")]).toEqual([["a.ts", "b.ts", "c.ts", "d.ts"], []]);
    expect(view.texts(".header .count")).toEqual(["4"]);
  });

  it("keeps the focus when the pressed control goes: N more on the first file it shows, Stage all in the header of the group that takes the files, a row's Unstage on the next row's", async () => {
    const changed = (path: string): StatusEntry => GitFixtures.entry(path, FileState.Unmodified, FileState.Modified);
    const staged = (path: string): StatusEntry => GitFixtures.entry(path, FileState.Modified, FileState.Unmodified);
    const paths: readonly string[] = ["c.ts", "d.ts", "e.ts", "f.ts"];
    let entries: readonly StatusEntry[] = paths.map(changed);
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.stage": null, "git.unstage": null,
      "git.status": () => GitFixtures.status(entries).toJson() });
    const rowOf = (path: string): HTMLElement | undefined => view.all(".file").find(t => t.querySelector(".path")?.textContent === path);
    const pressAsync = async (control: HTMLElement | null | undefined, done: () => boolean): Promise<void> => {
      if (control === null || control === undefined)
        throw new Error("No control.");
      await view.untilAsync(() => !control.matches(":disabled"));
      control.closest<HTMLElement>(".file")?.querySelector<HTMLElement>(".name")?.focus();
      control.focus();
      control.click();
      await view.untilAsync(done);
      await view.fixture.whenStable();
    };

    await pressAsync(view.find(".more"), () => view.all(".more").length === 0);
    const afterMore: boolean = document.activeElement === rowOf("e.ts")?.querySelector(".name");
    entries = paths.map(staged);
    await pressAsync(view.find(".move-all"), () => view.texts(".header .title").join() === "Staged");
    const afterStageAll: boolean = document.activeElement?.closest("nol-git-file-group .header") !== null;
    entries = [changed("c.ts"), ...paths.slice(1).map(staged)];
    await pressAsync(rowOf("c.ts")?.querySelector(".move"), () => view.texts(".header .title").join() === "Staged,Changes");
    const afterUnstage: boolean = document.activeElement === rowOf("d.ts")?.querySelector(".move");

    expect([afterMore, afterStageAll, afterUnstage]).toEqual([true, true, true]);
  });

  it("opens a row's diff under it from the row or its button, wraps its lines, and closes it", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status(entries).toJson(),
      "git.diff": GitFixtures.diff("docs/c.md", [LineKind.Context, "a"], [LineKind.Removed, "b"], [LineKind.Added, "c"]).toJson()
    });
    const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(3) li:has(.file)");

    row.querySelector<HTMLElement>(".name")?.click();
    await view.untilAsync(() => (row.querySelector(".diff")?.textContent ?? "Reading the diff…") !== "Reading the diff…");
    const kindOf = (element: Element): string => ["meta-line", "removed-line", "added-line"].find(t => element.classList.contains(t)) ?? "";
    const lines: readonly (string | null)[] = [...row.querySelectorAll(".diff > *")].map(t => `${t.localName}|${kindOf(t)}|${t.textContent}`);
    row.querySelector<HTMLElement>(".wrap")?.click();
    await view.fixture.whenStable();
    const wrapped: readonly [boolean, string | null] = [row.querySelector(".diff")?.classList.contains("wrapped") ?? false, row.querySelector(".wrap")?.getAttribute("aria-pressed") ?? null];
    row.querySelector<HTMLElement>(".wrap")?.click();
    await view.fixture.whenStable();
    row.querySelector<HTMLElement>(".expand")?.click();
    await view.fixture.whenStable();

    expect(lines).toEqual(["div|meta-line|@@ -1,1 +1,2 @@Stage hunk", "div|| a", "button|removed-line|-b", "button|added-line|+c"]);
    expect(wrapped).toEqual([true, "true"]);
    expect([row.querySelector(".diff"), row.querySelector(".wrap")]).toEqual([null, null]);
    expect(view.requested("git.diff")).toEqual([{ folder: GitFixtures.folder, scope: { kind: "Worktree" } }]);
  });

  it("chooses added and removed lines, stages a hunk's chosen lines or the whole hunk, and unstages a staged file's hunk, its action at the hunk's end", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status(entries).toJson(),
      "git.stageLines": null,
      "git.unstageLines": null,
      "git.diff": new GitDiff([
        ...GitFixtures.diff("docs/c.md", [LineKind.Context, "a"], [LineKind.Removed, "b"], [LineKind.Added, "c"]).files,
        ...GitFixtures.diff("src/b.ts", [LineKind.Context, "a"], [LineKind.Removed, "b"], [LineKind.Added, "c"]).files
      ], 0, 0, false).toJson()
    });
    const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
    const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(3) li:has(.file)");
    const action = (): HTMLButtonElement | null => row.querySelector<HTMLButtonElement>(".hunk-action");
    const pressed = (): readonly (string | null)[] => [...row.querySelectorAll("button.line")].map(t => t.getAttribute("aria-pressed"));
    const writes = vi.spyOn(view.state, "stageLinesAsync");
    const writeAsync = async (button: HTMLElement | null): Promise<void> => {
      button?.click();
      await Promise.all(writes.mock.results.map(t => t.value));
      await view.fixture.whenStable();
    };

    row.querySelector<HTMLElement>(".name")?.click();
    await view.untilAsync(() => action() !== null);
    const whole: readonly [string | null | undefined, readonly (string | null)[]] = [action()?.textContent, pressed()];
    const diff: DOMRect = row.querySelector(".diff")?.getBoundingClientRect() ?? new DOMRect();
    const hunk: DOMRect = row.querySelector(".hunk")?.getBoundingClientRect() ?? new DOMRect();
    const button: DOMRect = action()?.getBoundingClientRect() ?? new DOMRect();
    const context: DOMRect = row.querySelector(".diff > div:nth-child(2)")?.getBoundingClientRect() ?? new DOMRect();
    const line: DOMRect = row.querySelector("button.line")?.getBoundingClientRect() ?? new DOMRect();
    row.querySelector<HTMLElement>("button.line:last-of-type")?.click();
    row.querySelector<HTMLElement>("button.removed-line")?.click();
    row.querySelector<HTMLElement>("button.added-line")?.click();
    await view.fixture.whenStable();
    const chosen: readonly [string | null | undefined, readonly (string | null)[], boolean] = [action()?.textContent, pressed(), row.querySelector(".removed-line")?.classList.contains("chosen") ?? false];
    await writeAsync(action());
    const cleared: readonly (string | null)[] = pressed();
    await writeAsync(action());
    view.find<HTMLElement>("nol-git-file-group:nth-of-type(2) li:has(.file) .name").click();
    await view.untilAsync(() => view.all(".hunk-action").length === 2);
    const unstage: string | null = view.find("nol-git-file-group:nth-of-type(2) .hunk-action").textContent;
    view.find<HTMLElement>("nol-git-file-group:nth-of-type(2) button.added-line").click();
    await view.fixture.whenStable();
    const unstageLine: string | null = view.find("nol-git-file-group:nth-of-type(2) .hunk-action").textContent;
    await writeAsync(view.find("nol-git-file-group:nth-of-type(2) .hunk-action"));

    expect(whole).toEqual(["Stage hunk", ["false", "false"]]);
    expect(chosen).toEqual(["Stage 1 line", ["true", "false"], true]);
    expect(cleared).toEqual(["false", "false"]);
    expect([unstage, unstageLine]).toEqual(["Unstage hunk", "Unstage 1 line"]);
    expect([rem(hunk.right - button.right), rem(line.left - context.left), rem(line.width - context.width), rem(button.top - hunk.top) >= 0, rem(hunk.bottom - button.bottom) >= 0])
      .toEqual([0.5, 0, 0, true, true]);
    expect(rem(hunk.left - diff.left)).toBeCloseTo(rem(context.left - diff.left));
    const folder: string = GitFixtures.folder;
    expect(view.context.callsOf("requestAsync").filter(t => t[0] === "git.stageLines" || t[0] === "git.unstageLines")).toEqual([
      ["git.stageLines", { folder, path: "docs/c.md", lines: [1], basedOn: "f1" }],
      ["git.stageLines", { folder, path: "docs/c.md", lines: [1, 2], basedOn: "f1" }],
      ["git.unstageLines", { folder, path: "src/b.ts", lines: [2], basedOn: "f1" }]
    ]);
  });

  it("colors an open diff's code as the editor does, its signs plain and its lines on their added and removed backgrounds, reading only the open diff's lines", async () => {
    const read = vi.spyOn(ShikiLineTokenizer.prototype, "tokenizeLine");
    onTestFinished(() => read.mockRestore());
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status(entries).toJson(),
      "git.diff": GitFixtures.diff("src/b.ts", [LineKind.Context, "const a = 1;"], [LineKind.Removed, "/* old"], [LineKind.Added, "let b = 2;"]).toJson()
    });
    const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(2) li:has(.file)");
    const lines = (): readonly HTMLElement[] => [...row.querySelectorAll<HTMLElement>(".diff > .line:not(.hunk)")];
    const colored = (line: Element): string => [...line.querySelectorAll("span")].filter(t => t.className === "token-keyword" || t.className === "token-comment")
      .map(t => `${t.className}:${t.textContent}`).join(" ");

    row.querySelector<HTMLElement>(".expand")?.click();
    await view.untilAsync(() => lines().length === 3 && colored(lines()[2] ?? row) !== "");
    const signs: readonly (string | null)[] = lines().map(t => [...t.childNodes].find(u => u.nodeType === Node.TEXT_NODE)?.textContent ?? null);
    const kinds: readonly string[] = lines().map(t => ["removed-line", "added-line"].find(u => t.classList.contains(u)) ?? "");

    expect(lines().map(colored)).toEqual(["token-keyword:const", "token-comment:/* old", "token-keyword:let"]);
    expect([signs, lines().map(t => t.textContent)]).toEqual([[" ", "-", "+"], [" const a = 1;", "-/* old", "+let b = 2;"]]);
    expect(kinds).toEqual(["", "removed-line", "added-line"]);
    expect(new Set(read.mock.calls.map(t => t[0]))).toEqual(new Set(["const a = 1;", "/* old", "let b = 2;"]));
  });

  it("says it is reading, then why a diff couldn't be read, and reads an open diff again when the status moves", async () => {
    let fingerprint: string = "f1";
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status(entries).toJson() });
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.diff"], { ...GitFixtures.watching, "git.status": () => GitFixtures.status(entries, null, { fingerprint }).toJson() });
    const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(2) li:has(.file)");
    const text = (): string | undefined => row.querySelector(".diff")?.textContent;

    row.querySelector<HTMLElement>(".expand")?.click();
    await view.fixture.whenStable();
    const reading: string | undefined = text();
    await held.answerAsync("git.diff", GitFixtures.lost("The diff timed out."));
    await view.untilAsync(() => text() !== reading);
    const failed: string | undefined = text();
    fingerprint = "f2";
    view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await held.answerAsync("git.diff", GitFixtures.diff("other.ts", [LineKind.Added, "x"]).toJson());
    await view.untilAsync(() => text() !== failed);

    expect([reading, failed, text()]).toEqual(["Reading the diff…", "The diff timed out.", "Git shows no lines for this file."]);
    expect(view.requested("git.diff")).toEqual([
      { folder: GitFixtures.folder, scope: { kind: "Staged" } }, { folder: GitFixtures.folder, scope: { kind: "Staged" } }
    ]);
  });

  it("passes a diff read that fails other than as the window's failure to the error handler, without showing it as the diff's failure", async () => {
    const bug = new TypeError("Not a function.");
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status(entries).toJson(), "git.diff": bug });
    const reported: Promise<unknown> = new Promise(resolve => vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(resolve));
    const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(2) li:has(.file)");

    row.querySelector<HTMLElement>(".expand")?.click();

    expect(await reported).toBe(bug);
    await view.fixture.whenStable();
    expect(row.querySelector(".diff")?.textContent).toBe("Reading the diff…");
  });

  it("keeps the newest status's diff when an older read answers after it", async () => {
    let fingerprint: string = "f1";
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status(entries).toJson() });
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.diff"], { ...GitFixtures.watching, "git.status": () => GitFixtures.status(entries, null, { fingerprint }).toJson() });
    const reads = vi.spyOn(view.state, "diffAsync");
    const rowsOf: typeof GitDiffRow.rowsOf = GitDiffRow.rowsOf.bind(GitDiffRow);
    let built: () => void = () => undefined;
    const builds = vi.spyOn(GitDiffRow, "rowsOf").mockImplementation(file => {
      const rows: readonly GitDiffRow[] = rowsOf(file);
      built();
      return rows;
    });
    onTestFinished(() => builds.mockRestore());
    const builtAsync = (): Promise<void> => new Promise(resolve => built = resolve);
    const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(2) li:has(.file)");
    const lines = (): readonly string[] => [...row.querySelectorAll(".diff > *")].map(t => t.textContent ?? "");

    row.querySelector<HTMLElement>(".expand")?.click();
    const older: (answer: JsonValue | Error) => void = await held.nextAsync("git.diff");
    fingerprint = "f2";
    view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    const newerBuilt: Promise<void> = builtAsync();
    await held.answerAsync("git.diff", GitFixtures.diff("src/b.ts", [LineKind.Added, "newer"]).toJson());
    await newerBuilt;
    await view.fixture.whenStable();
    const newer: readonly string[] = lines();
    const olderBuilt: Promise<void> = builtAsync();
    older(GitFixtures.diff("src/b.ts", [LineKind.Added, "older"]).toJson());
    await olderBuilt;
    await view.fixture.whenStable();

    expect([reads.mock.calls.length, newer, lines()]).toEqual([2, ["@@ -1,1 +1,2 @@Unstage hunk", "+newer"], ["@@ -1,1 +1,2 @@Unstage hunk", "+newer"]]);
  });
});
