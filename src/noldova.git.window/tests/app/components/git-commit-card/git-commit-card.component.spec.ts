/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ConflictKind, FileState, GitOperation, OperationKind } from "@noldova/git.protocol";
import { describe, expect, it, vi } from "vitest";

import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitCommitCardComponent", () => {
  const typeAsync = async (view: GitViewFixture, text: string): Promise<void> => {
    const field: HTMLTextAreaElement = view.find<HTMLTextAreaElement>(".field");
    field.value = text;
    field.dispatchEvent(new Event("input"));
    await view.fixture.whenStable();
  };

  const commit = (view: GitViewFixture): HTMLButtonElement => view.find<HTMLButtonElement>(".commit");

  it("commits the staged files with the typed message once there is one, then empties the field", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.commit": null,
      "git.status": GitFixtures.status([GitFixtures.entry("a.ts", FileState.Modified, FileState.Unmodified), GitFixtures.entry("b.ts", FileState.Added, FileState.Unmodified)]).toJson()
    });

    const before: readonly [string, string, boolean] = [view.find<HTMLTextAreaElement>(".field").placeholder, view.texts(".commit .nol-button-label")[0] ?? "", commit(view).disabled];
    await typeAsync(view, "   ");
    const blank: boolean = commit(view).disabled;
    await typeAsync(view, "  Fix the view  ");
    const commits = vi.spyOn(view.state, "commitAsync");
    commit(view).click();
    await commits.mock.results[0]?.value;
    await view.fixture.whenStable();

    expect([before, blank, view.find<HTMLTextAreaElement>(".field").value]).toEqual([["Message", "Commit 2 files", true], true, ""]);
    expect(view.requested("git.commit")).toEqual([{ folder: GitFixtures.folder, message: "Fix the view", basedOn: "f1" }]);
    expect(view.all(".hint")).toHaveLength(0);
  });

  it("names a single staged file", async () => {
    const one: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status([GitFixtures.entry("a.ts", FileState.Modified, FileState.Unmodified)]).toJson() });

    expect(one.texts(".commit .nol-button-label")).toEqual(["Commit 1 file"]);
  });

  it("offers no commit and names Commit alone when nothing is staged", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status([GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Modified)]).toJson() });
    await typeAsync(view, "Fix");

    expect([view.texts(".commit .nol-button-label")[0], commit(view).disabled]).toEqual(["Commit", true]);
  });

  it("holds the merge until its conflicts are staged, then commits it with git's message", async () => {
    const operation: GitOperation = new GitOperation(OperationKind.Merge, "main", "Merge branch 'main' into dev");
    const conflicted = GitFixtures.status([GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)], null, { operation });
    let status = conflicted;
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.commit": null, "git.status": () => status.toJson() });

    const held: readonly [string, string, boolean, readonly string[]] = [
      view.find<HTMLTextAreaElement>(".field").placeholder, view.texts(".commit .nol-button-label")[0] ?? "", commit(view).disabled, view.texts(".hint")
    ];
    status = GitFixtures.status([GitFixtures.entry("a.ts", FileState.Modified, FileState.Unmodified)], null, { operation, fingerprint: "f2" });
    view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await GitFixtures.untilAsync(() => view.state.status()?.fingerprint === "f2");
    await view.fixture.whenStable();
    const staged: boolean = commit(view).disabled;
    commit(view).click();

    expect(staged).toBe(false);
    expect(held).toEqual(["Merge branch 'main' into dev", "Commit the merge", true, ["Stage the 1 conflicted file to commit the merge."]]);
    expect(view.requested("git.commit")).toEqual([{ folder: GitFixtures.folder, message: "Merge branch 'main' into dev", basedOn: "f2" }]);
  });

  it("asks for a message when git's merge gives none", async () => {
    const operation: GitOperation = new GitOperation(OperationKind.Revert, null, null);
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching,
      "git.status": GitFixtures.status([GitFixtures.entry("a.ts", FileState.Modified, FileState.Unmodified)], null, { operation }).toJson()
    });

    expect([view.find<HTMLTextAreaElement>(".field").placeholder, commit(view).disabled]).toEqual(["Message", true]);
  });
});
