/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { JsonValue } from "@noldova/context.json";
import { FailureCode, GitCommit, GitCommitDetail, GitGraphCommit, GitPrediction, LineKind, PredictionOutcome } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitCommitView } from "../../../../src/app/models/git-commit-view.ts";
import { GitRuntimeClient } from "../../../../src/app/services/git-runtime-client.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { FixtureLine, GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitCommitDetailComponent reads", () => {
  const commitOf = (id: string, parents: readonly string[] = []): GitGraphCommit =>
    new GitGraphCommit(new GitCommit(id, parents, "Sample Author", "2026-11-20T14:02:00Z", `Commit ${id.slice(0, 4)}`), "author@example.com", []);
  const show = (commit: GitGraphCommit): void => GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
  const answers: Readonly<Record<string, JsonValue>> = {
    ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff("src/a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
    "git.commitDetail": new GitCommitDetail("f".repeat(40), "For another commit.", "Other Person", "other@example.com", "2026-11-21T09:30:00Z", false).toJson()
  };
  const handledBy = (): WritableSignal<string[]> => {
    const handled: WritableSignal<string[]> = signal<string[]>([]);
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.update(t => [...t, String(error)]));
    return handled;
  };

  it("reads a first SHA-256 commit against SHA-256's empty tree, opens a closed folder again, copies the id, and reports a copy that fails", async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    const id: string = "a".repeat(64);
    show(commitOf(id));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync(answers, ".detail .files");
    const handled: WritableSignal<string[]> = handledBy();
    const folder = (): HTMLElement => view.find(".file-row.folder");
    const writes = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("copy refused"));
    onTestFinished(() => writes.mockRestore());

    folder().click();
    await view.untilAsync(() => folder().getAttribute("aria-expanded") === "false");
    folder().click();
    await view.untilAsync(() => folder().getAttribute("aria-expanded") === "true");
    view.find("[aria-label='Copy commit id']").click();
    view.find("[aria-label='Copy commit id']").click();
    await GitFixtures.untilAsync(() => handled().length > 0);

    expect(view.requested("git.diff")).toEqual([{ folder: GitFixtures.folder, scope: { kind: "Range", from: "6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321", to: id } }]);
    expect([writes.mock.calls, handled(), view.all(".message").length]).toEqual([[[id], [id]], ["Error: copy refused"], 0]);
  });

  it("drops predictions that answer after a newer commit is shown, leaves them out when Git can't tell, and reports ones that fail outside Git", async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    show(commitOf("1".repeat(40)));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync(answers, ".detail .files");
    const handled: WritableSignal<string[]> = handledBy();
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.predict"], answers);
    const clean: JsonValue = new GitPrediction(PredictionOutcome.Clean, []).toJson();

    show(commitOf("2".repeat(40)));
    await view.fixture.whenStable();
    show(commitOf("3".repeat(40)));
    await view.fixture.whenStable();
    await held.answerAsync("git.predict", clean);
    await held.answerAsync("git.predict", clean);
    await held.answerAsync("git.predict", GitFixtures.failure(FailureCode.Git, null, "Git can't tell."));
    await held.answerAsync("git.predict", clean);
    await view.fixture.whenStable();
    expect(view.all(".prediction")).toHaveLength(0);

    show(commitOf("4".repeat(40)));
    await held.answerAsync("git.predict", new Error("predict broke"));
    await held.answerAsync("git.predict", clean);
    await GitFixtures.untilAsync(() => handled().includes("Error: predict broke"));
    expect(view.all(".prediction")).toHaveLength(0);
  });

  it("keeps the latest read's predictions when an older read for the same commit, from before the repository changed, answers last", async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    show(commitOf("1".repeat(40)));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync(answers, ".detail .files");
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.predict"], answers);
    const reads = vi.spyOn(GitRuntimeClient.prototype, "predictAsync");
    onTestFinished(() => reads.mockRestore());
    const lines = (): readonly string[] => view.texts(".prediction");

    view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    const older = [await held.nextAsync("git.predict"), await held.nextAsync("git.predict")];
    view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    const newer = [await held.nextAsync("git.predict"), await held.nextAsync("git.predict")];
    newer.forEach(t => t(new GitPrediction(PredictionOutcome.Clean, []).toJson()));
    await view.untilAsync(() => lines().length === 2);
    older.forEach(t => t(new GitPrediction(PredictionOutcome.Conflicts, ["src/a.ts"]).toJson()));
    await Promise.allSettled(reads.mock.results.flatMap(t => t.type === "return" ? [t.value] : []));
    for (let step = 0; step < 4; step++)
      await Promise.resolve();
    await view.fixture.whenStable();

    expect([reads.mock.calls.length, lines()]).toEqual([4, ["Cherry-pick applies cleanly.", "Revert applies cleanly."]]);
  });

  it("drops diffs that answer after a newer commit is shown, says when the diff read was lost, and reports reads that fail outside Git", async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    show(commitOf("1".repeat(40)));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync(answers, ".detail .files");
    const handled: WritableSignal<string[]> = handledBy();
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.diff"], { ...answers, "git.commitDetail": new Error("detail broke") });
    const note = (): string => view.element.querySelector(".detail [role=alert]")?.textContent?.trim() ?? "";

    show(commitOf("2".repeat(40)));
    await view.fixture.whenStable();
    show(commitOf("3".repeat(40)));
    await view.fixture.whenStable();
    await held.answerAsync("git.diff", GitFixtures.diff("late.ts", new FixtureLine(LineKind.Added, "late")).toJson());
    show(commitOf("4".repeat(40)));
    await view.fixture.whenStable();
    await held.answerAsync("git.diff", GitFixtures.failure(FailureCode.Git, null, "Late refusal."));
    await held.answerAsync("git.diff", GitFixtures.lost("Window closed."));
    await view.untilAsync(() => note() === "The history couldn't be read.");
    show(commitOf("5".repeat(40)));
    await held.answerAsync("git.diff", new Error("diff broke"));
    await GitFixtures.untilAsync(() => handled().includes("Error: diff broke"));

    expect([view.all(".file-row").length, note(), handled().filter(t => t === "Error: detail broke").length]).toEqual([0, "", 4]);
  });

  it("leaves the signature row out when its read fails, reporting only a failure outside Git", async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    show(commitOf("1".repeat(40)));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync(answers, ".detail .files");
    const handled: WritableSignal<string[]> = handledBy();
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.commitSignature"], answers);

    show(commitOf("2".repeat(40)));
    await held.answerAsync("git.commitSignature", GitFixtures.failure(FailureCode.Git, null, "Signature refused."));
    show(commitOf("3".repeat(40)));
    await held.answerAsync("git.commitSignature", new Error("signature broke"));
    await GitFixtures.untilAsync(() => handled().length > 0);

    expect([handled(), view.all(".detail .signature").length]).toEqual([["Error: signature broke"], 0]);
  });
});
