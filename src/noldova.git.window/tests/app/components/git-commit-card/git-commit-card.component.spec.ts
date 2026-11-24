/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ConflictKind, FileState, GitCommit, GitCommitDetail, GitCommitSigning, GitLog, GitOperation, OperationKind, SigningFormat, StatusUpstream
} from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitViewOptions } from "../../../../src/app/services/git-view-options.ts";
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

  it("amends the last commit with its whole message in the field, needing nothing staged, then turns amending off", async () => {
    const head = "0123456789abcdef0123456789abcdef01234567";
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.amend": null, "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 1, 0, false)).toJson(),
      "git.log": new GitLog([new GitCommit(head, [], "A Person", "2026-11-20T14:02:00Z", "Fix the view")], false).toJson(),
      "git.commitDetail": new GitCommitDetail(head, "Why it changed.", "A Person", "a@example.com", "2026-11-20T14:02:00Z", false).toJson()
    });
    const box: HTMLInputElement = view.find<HTMLInputElement>(".amend input");
    expect([box.disabled, box.checked, commit(view).disabled]).toEqual([false, false, true]);

    box.click();
    await view.untilAsync(() => view.find<HTMLTextAreaElement>(".field").value.length > 0);
    expect([view.find<HTMLTextAreaElement>(".field").value, view.texts(".commit .nol-button-label")[0], commit(view).disabled, view.all(".commit-push").length])
      .toEqual(["Fix the view\n\nWhy it changed.", "Amend commit", false, 0]);
    const commits = vi.spyOn(view.state, "commitAsync");
    commit(view).click();
    await commits.mock.results[0]?.value;
    await view.fixture.whenStable();

    expect(view.requested("git.amend")).toEqual([{ folder: GitFixtures.folder, message: "Fix the view\n\nWhy it changed.", basedOn: "f1" }]);
    expect([view.find<HTMLTextAreaElement>(".field").value, view.find<HTMLInputElement>(".amend input").checked, view.texts(".commit .nol-button-label")[0]]).toEqual(["", false, "Commit"]);
  });

  it("offers no amend once the last commit is on the upstream", async () => {
    const pushed: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status([], new StatusUpstream("origin/main", 0, 0, false)).toJson()
    });
    expect([pushed.find<HTMLInputElement>(".amend input").disabled, pushed.find(".amend").title]).toEqual([true, "The last commit is already pushed, or there is none, so it can't be amended"]);
  });

  it("empties the field when amending is turned off", async () => {
    const head = "0123456789abcdef0123456789abcdef01234567";
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(),
      "git.log": new GitLog([new GitCommit(head, [], "A Person", "2026-11-20T14:02:00Z", "Start")], false).toJson(),
      "git.commitDetail": new GitCommitDetail(head, "", "A Person", "a@example.com", "2026-11-20T14:02:00Z", false).toJson()
    });
    view.find<HTMLInputElement>(".amend input").click();
    await view.untilAsync(() => view.find<HTMLTextAreaElement>(".field").value === "Start");
    view.find<HTMLInputElement>(".amend input").click();
    await view.untilAsync(() => view.find<HTMLTextAreaElement>(".field").value === "");

    expect([view.state.amending(), view.texts(".commit .nol-button-label")[0]]).toEqual([false, "Commit"]);
  });

  it("commits and then pushes on Commit and push", async () => {
    const staged = [GitFixtures.entry("a.ts", FileState.Modified, FileState.Unmodified)];
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.commit": null, "git.push": null,
      "git.status": GitFixtures.status(staged, new StatusUpstream("origin/main", 0, 0, false)).toJson()
    });
    await typeAsync(view, "Fix the view");
    const writes = vi.spyOn(view.state, "commitAndPushAsync");
    view.find<HTMLButtonElement>(".commit-push").click();
    await writes.mock.results[0]?.value;
    await view.fixture.whenStable();

    expect(view.texts(".actions .nol-button-label")).toEqual(["Commit and push", "Commit 1 file"]);
    expect([view.requested("git.commit"), view.requested("git.push")]).toEqual([
      [{ folder: GitFixtures.folder, message: "Fix the view", basedOn: "f1" }], [{ folder: GitFixtures.folder, basedOn: "f1" }]
    ]);
  });

  it("offers no Commit and push on a branch with no upstream", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching,
      "git.status": GitFixtures.status([GitFixtures.entry("a.ts", FileState.Modified, FileState.Unmodified)]).toJson() });

    expect([view.all(".commit-push").length, view.texts(".actions .nol-button-label")]).toEqual([0, ["Commit 1 file"]]);
  });

  it("pushes nothing when Commit and push's commit fails", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.commit": GitFixtures.lost("no commit"), "git.push": null,
      "git.status": GitFixtures.status([GitFixtures.entry("a.ts", FileState.Modified, FileState.Unmodified)], new StatusUpstream("origin/main", 0, 0, false)).toJson()
    });

    await typeAsync(view, "Fix the view");
    const writes = vi.spyOn(view.state, "commitAndPushAsync");
    view.find<HTMLButtonElement>(".commit-push").click();
    await writes.mock.results[0]?.value;
    await view.fixture.whenStable();

    expect([view.requested("git.commit").length, view.requested("git.push")]).toEqual([1, []]);
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
    expect(held).toEqual(["Merge branch 'main' into dev", "Commit the merge", true, ["Resolve the one conflicted file to commit the merge."]]);
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

  it("offers Suggest, not built yet, beside the message's heading only while the app turns AI features on", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const off: readonly number[] = [view.all(".suggest").length, view.all(".heading > *").length];
    GitViewOptions.showsAiFeatures.set(true);
    onTestFinished(() => GitViewOptions.showsAiFeatures.set(false));
    await view.untilAsync(() => view.all(".suggest").length === 1);
    const suggest: HTMLButtonElement = view.find<HTMLButtonElement>(".suggest");

    expect([off, view.texts(".suggest"), suggest.disabled, suggest.title]).toEqual([[0, 1], ["auto_awesomeSuggest"], true, "Not built yet"]);
  });
  it.each([
    [SigningFormat.Ssh, "Signed with SSH key"],
    [SigningFormat.OpenPgp, "Signed with a GPG key"],
    [SigningFormat.X509, "Signed with an X.509 certificate"]
  ])("notes after the amend box, outside its label, that a new commit will be signed in the %s format", async (format, note) => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commitSigning": new GitCommitSigning(true, format).toJson()
    });
    await view.untilAsync(() => view.all(".signing").length === 1);
    const signing: HTMLElement = view.find<HTMLElement>(".signing");
    const box: HTMLInputElement = view.find<HTMLInputElement>(".amend input");
    signing.click();
    await view.fixture.whenStable();

    expect([view.texts(".signing"), signing.closest("label"), signing.previousElementSibling?.className, box.checked]).toEqual([[note], null, "amend", false]);
    expect(view.requested("git.commitSigning")).toEqual([{ folder: GitFixtures.folder }]);
  });

  it("notes nothing when the repository doesn't sign, and reads how it signs again with each refresh", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    await GitFixtures.untilAsync(() => view.state.commitSigning() !== null);
    await view.state.refreshAsync();
    await GitFixtures.untilAsync(() => view.requested("git.commitSigning").length === 2);
    await view.fixture.whenStable();

    expect([view.all(".signing").length, view.requested("git.status").length, view.requested("git.commitSigning").length]).toEqual([0, 2, 2]);
  });

  it("notes nothing when the repository signs in a format git doesn't know", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commitSigning": new GitCommitSigning(true, null).toJson()
    });
    await GitFixtures.untilAsync(() => view.state.commitSigning() !== null);
    await view.fixture.whenStable();

    expect(view.all(".signing")).toHaveLength(0);
  });

  it("notes nothing and logs why when it can't read how commits are signed", async () => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.commitSigning": GitFixtures.lost("unreadable")
    });
    await (view.context.callsOf("log").length === 1 ? Promise.resolve() : GitFixtures.loggedAsync(view.context, 1));
    await view.fixture.whenStable();

    expect([view.all(".signing").length, view.context.callsOf("log")]).toEqual([0, [["The Git view couldn't read how commits are signed: unreadable"]]]);
  });
});
