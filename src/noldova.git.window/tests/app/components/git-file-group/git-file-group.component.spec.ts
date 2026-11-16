/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { JsonValue } from "@noldova/context.json";
import { ConflictKind, FileState, LineCounts, LineKind } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

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

  it("draws each group's title and count, and each row's state, name, folder and counts or conflict kind", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status(entries).toJson() });

    expect(view.texts(".header .title, .header .count")).toEqual(["Conflicts", "1", "Staged", "1", "Changes", "3"]);
    expect(view.all("nol-git-file-group").map(t => [...t.querySelectorAll(".header > *")].map(u => ["title", "count", "spacer", "move-all"].find(c => u.classList.contains(c))))).toEqual([
      ["title", "count", "spacer"], ["title", "count", "spacer", "move-all"], ["title", "count", "spacer", "move-all"]
    ]);
    expect(view.all(".file .name").map(t => [...t.querySelectorAll(".state, .path, .kind, .counts")].map(u => u.textContent).join(" "))).toEqual([
      "! a.ts Both changed", "M src/b.ts +12-1", "M docs/c.md +4-1", "U d.ts +9", "U e.png"
    ]);
    expect(view.all(".directory").map(t => t.textContent)).toEqual(["", "src/", "docs/", "", ""]);
    expect(view.all(".state").map(t => t.dataset["tone"])).toEqual(["Conflict", "Modified", "Modified", "Untracked", "Untracked"]);
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

  it("offers no diff for a conflicted file: its name is not a button and it has no expand button", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status(entries).toJson() });
    const conflict: HTMLElement = view.find("nol-git-file-group:nth-of-type(1) .file");

    expect([conflict.querySelector(".name")?.localName, conflict.querySelector(".expand"), [...conflict.querySelectorAll("button")].map(t => t.matches(".move"))])
      .toEqual(["div", null, [true]]);
  });

  it("shows two files of a group of more than three and a row naming the rest, which shows them all", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status(["a.ts", "b.ts", "c.ts", "d.ts"].map(t => GitFixtures.entry(t, FileState.Unmodified, FileState.Modified))).toJson()
    });
    const names = (): readonly string[] => view.all(".file .path").map(t => t.textContent ?? "");

    const before: readonly [readonly string[], readonly string[]] = [names(), view.texts(".more")];
    await view.clickAsync(".more");

    expect(before).toEqual([["a.ts", "b.ts"], ["and 2 more"]]);
    expect([names(), view.all(".more")]).toEqual([["a.ts", "b.ts", "c.ts", "d.ts"], []]);
    expect(view.texts(".header .count")).toEqual(["4"]);
  });

  it("opens a row's diff under it from the row or its button, wraps its lines, and closes it", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status(entries).toJson(),
      "git.diff": GitFixtures.diff("docs/c.md", [LineKind.Context, "a"], [LineKind.Removed, "b"], [LineKind.Added, "c"]).toJson()
    });
    const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(3) li");

    row.querySelector<HTMLElement>(".name")?.click();
    await view.untilAsync(() => (row.querySelector(".diff")?.textContent ?? "Reading the diff…") !== "Reading the diff…");
    const lines: readonly (string | null)[] = [...row.querySelectorAll(".diff > div")].map(t => `${t.className}|${t.textContent}`);
    row.querySelector<HTMLElement>(".wrap")?.click();
    await view.fixture.whenStable();
    const wrapped: readonly [boolean, string | null] = [row.querySelector(".diff")?.classList.contains("wrapped") ?? false, row.querySelector(".wrap")?.getAttribute("aria-pressed") ?? null];
    row.querySelector<HTMLElement>(".wrap")?.click();
    await view.fixture.whenStable();
    row.querySelector<HTMLElement>(".expand")?.click();
    await view.fixture.whenStable();

    expect(lines).toEqual(["meta-line|@@ -1,1 +1,2 @@", "| a", "removed-line|-b", "added-line|+c"]);
    expect(wrapped).toEqual([true, "true"]);
    expect([row.querySelector(".diff"), row.querySelector(".wrap")]).toEqual([null, null]);
    expect(view.requested("git.diff")).toEqual([{ folder: GitFixtures.folder, scope: { kind: "Worktree" } }]);
  });

  it("says it is reading, then why a diff couldn't be read, and reads an open diff again when the status moves", async () => {
    let fingerprint: string = "f1";
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status(entries).toJson() });
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.diff"], { ...GitFixtures.watching, "git.status": () => GitFixtures.status(entries, null, { fingerprint }).toJson() });
    const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(2) li");
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
    const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(2) li");

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
    const row: HTMLElement = view.find("nol-git-file-group:nth-of-type(2) li");
    const lines = (): readonly string[] => [...row.querySelectorAll(".diff > div")].map(t => t.textContent ?? "");

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

    expect([reads.mock.calls.length, newer, lines()]).toEqual([2, ["@@ -1,1 +1,2 @@", "+newer"], ["@@ -1,1 +1,2 @@", "+newer"]]);
  });
});
