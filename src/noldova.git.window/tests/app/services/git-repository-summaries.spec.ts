/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { ConflictKind, FailureCode, FileState, StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished } from "vitest";

import type { GitRepositorySummary } from "../../../src/app/models/git-repository-summary.ts";
import { GitRepositorySummaries } from "../../../src/app/services/git-repository-summaries.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../fixtures/git-held-requests.fixture.ts";

describe("GitRepositorySummaries", () => {
  const folder: string = "/work/site";
  const status: JsonValue = GitFixtures.status([
    GitFixtures.entry("src/a.ts", FileState.Modified, FileState.Modified),
    GitFixtures.entry("notes.md", FileState.Untracked, FileState.Untracked),
    GitFixtures.entry("src/b.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)
  ], new StatusUpstream("origin/main", 2, 1, false), { branch: "feature/graph", truncated: true }).toJson();

  const shownAsync = async (summary: Signal<GitRepositorySummary | null>, done: (shown: GitRepositorySummary) => boolean): Promise<GitRepositorySummary> => {
    await GitFixtures.untilAsync(() => {
      const shown: GitRepositorySummary | null = summary();
      return !Object.isNull(shown) && done(shown);
    });
    const shown: GitRepositorySummary | null = summary();
    if (Object.isNull(shown))
      throw new Error("The summary went away.");
    return shown;
  };

  const disposedAfter = (summaries: GitRepositorySummaries): GitRepositorySummaries => {
    onTestFinished(() => summaries.dispose());
    return summaries;
  };

  const callsOf = (context: FakeWindowPartContext, method: string): number => context.callsOf("requestAsync").filter(t => t[0] === method).length;

  it("has no summary of a folder until it is read, and reads nothing for asking", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));

    expect(summaries.summaryOf(folder)()).toBeNull();
    expect(context.callsOf("requestAsync")).toEqual([]);
  });

  it("watches a folder once for every watch, reads its branch, upstream and changes, and counts a file in two groups once", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": status });
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));

    summaries.watch(folder);
    summaries.watch(folder);
    const shown: GitRepositorySummary = await shownAsync(summaries.summaryOf(folder), () => true);

    expect([shown.folder, shown.branch, shown.head, shown.upstream, shown.ahead, shown.behind, shown.gone]).toEqual([
      folder, "feature/graph", "0123456789abcdef0123456789abcdef01234567", "origin/main", 2, 1, false
    ]);
    expect([shown.staged, shown.changed, shown.conflicts, shown.files, shown.isTruncated, shown.isFetching, shown.failure]).toEqual([1, 2, 1, 3, true, false, null]);
    expect([callsOf(context, "git.watch"), callsOf(context, "git.status")]).toEqual([1, 1]);
  });

  it("stops watching only at the last unwatch, keeps the summary, and ignores a folder it doesn't watch", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": status });
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));
    summaries.watch(folder);
    summaries.watch(folder);
    await shownAsync(summaries.summaryOf(folder), () => true);

    summaries.unwatch("/work/other");
    summaries.unwatch(folder);
    const afterOne: number = callsOf(context, "git.unwatch");
    summaries.unwatch(folder);

    expect([afterOne, callsOf(context, "git.unwatch"), summaries.summaryOf(folder)()?.branch]).toEqual([0, 1, "feature/graph"]);
    expect(context.callsOf("requestAsync").at(-1)).toEqual(["git.unwatch", { folder }]);
  });

  it("reads a watched folder again when it changes, and not another folder or one no longer watched", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let branch: string = "main";
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": () => GitFixtures.status([], null, { branch }).toJson() });
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));
    const summary: Signal<GitRepositorySummary | null> = summaries.summaryOf(folder);
    summaries.watch(folder);
    await shownAsync(summary, t => t.branch === "main");

    branch = "feature/graph";
    context.raiseEvent("git.changed", { folder: "/work/other" });
    context.raiseEvent("git.changed", { folder });
    await shownAsync(summary, t => t.branch === "feature/graph");
    summaries.unwatch(folder);
    context.raiseEvent("git.changed", { folder });

    expect(callsOf(context, "git.status")).toBe(2);
  });

  it("reads once more after a read that a change arrived during, so the summary shows the later status", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.status"], GitFixtures.watching);
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));
    const summary: Signal<GitRepositorySummary | null> = summaries.summaryOf(folder);

    summaries.watch(folder);
    const first: (answer: JsonValue | Error) => void = await held.nextAsync("git.status");
    context.raiseEvent("git.changed", { folder });
    context.raiseEvent("git.changed", { folder });
    first(GitFixtures.status([], null, { branch: "main" }).toJson());
    await held.answerAsync("git.status", GitFixtures.status([], null, { branch: "feature/graph" }).toJson());

    expect((await shownAsync(summary, t => t.branch === "feature/graph")).branch).toBe("feature/graph");
    expect(callsOf(context, "git.status")).toBe(2);
  });

  it("marks a folder that isn't a repository as such, with no failure to show", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": GitFixtures.failure(FailureCode.NotRepository, null, "The folder isn't a repository.") });
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));

    summaries.watch(folder);
    const shown: GitRepositorySummary = await shownAsync(summaries.summaryOf(folder), () => true);

    expect([shown.failure, shown.isRepository]).toEqual([null, false]);
  });

  it("shows a read's failure without counts, and logs a watch or unwatch that fails", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const logged: Promise<void> = GitFixtures.loggedAsync(context, 2);
    GitFixtures.answerWith(context, {
      "git.status": GitFixtures.failure(FailureCode.Git, null, "Git couldn't read the index."),
      "git.watch": GitFixtures.lost("The runtime went away."),
      "git.unwatch": GitFixtures.lost("The runtime went away.")
    });
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));

    summaries.watch(folder);
    const shown: GitRepositorySummary = await shownAsync(summaries.summaryOf(folder), () => true);
    summaries.unwatch(folder);
    await logged;

    expect([shown.failure, shown.isRepository, shown.branch, shown.upstream, shown.ahead, shown.files, shown.isTruncated]).toEqual(["Git couldn't read the index.", true, null, null, 0, 0, false]);
    expect(context.callsOf("log")).toEqual([
      [`Changes in ${folder} made outside the workspace aren't followed, since the folder couldn't be watched: The runtime went away.`],
      [`The workspace couldn't stop watching ${folder}: The runtime went away.`]
    ]);
  });

  it("reads every listed folder once at most four at a time, a repeated folder once", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.status"]);
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));
    const folders: readonly string[] = ["/work/a", "/work/b", "/work/c", "/work/d", "/work/e", "/work/a"];

    const refreshed: Promise<void> = summaries.refreshAllAsync(folders);
    const firstFour: ((answer: JsonValue | Error) => void)[] = [];
    for (let read: number = 0; read < 4; read++)
      firstFour.push(await held.nextAsync("git.status"));
    const beforeAnswers: number = callsOf(context, "git.status");
    for (const answer of firstFour)
      answer(GitFixtures.status().toJson());
    await held.answerAsync("git.status", GitFixtures.status().toJson());
    await refreshed;

    expect([beforeAnswers, callsOf(context, "git.status")]).toEqual([4, 5]);
    expect(["/work/a", "/work/b", "/work/c", "/work/d", "/work/e"].map(t => summaries.summaryOf(t)()?.branch)).toEqual(["main", "main", "main", "main", "main"]);
  });

  it("reads only the folders with no summary and no read underway when asked for the missing ones, and a watch adds no read to one underway", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.status"], GitFixtures.watching);
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));

    const first: Promise<void> = summaries.readMissingAsync(["/work/a"]);
    const settleA: (answer: JsonValue | Error) => void = await held.nextAsync("git.status");
    summaries.watch("/work/a");
    const second: Promise<void> = summaries.readMissingAsync(["/work/a", "/work/b"]);
    const settleB: (answer: JsonValue | Error) => void = await held.nextAsync("git.status");
    settleA(GitFixtures.status().toJson());
    settleB(GitFixtures.status([], null, { branch: "feature/b" }).toJson());
    await Promise.all([first, second]);
    await summaries.readMissingAsync(["/work/a", "/work/b"]);

    expect([callsOf(context, "git.status"), callsOf(context, "git.watch")]).toEqual([2, 1]);
    expect([summaries.summaryOf("/work/a")()?.branch, summaries.summaryOf("/work/b")()?.branch]).toEqual(["main", "feature/b"]);
  });

  it("reads a folder the missing read just read only once when its row is followed, and again when it is followed after a stop", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.status"], GitFixtures.watching);
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));

    const missing: Promise<void> = summaries.readMissingAsync(["/work/a"]);
    (await held.nextAsync("git.status"))(GitFixtures.status().toJson());
    await missing;
    summaries.watch("/work/a");
    const followed: number = callsOf(context, "git.status");
    summaries.unwatch("/work/a");
    summaries.watch("/work/a");
    (await held.nextAsync("git.status"))(GitFixtures.status().toJson());

    expect([followed, callsOf(context, "git.status"), callsOf(context, "git.watch")]).toEqual([1, 2, 2]);
  });

  it("fetches four folders at a time on the status each just read, shows them fetching, reads them again, and keeps a failure on its own row", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    let fingerprint: string = "f1";
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.fetch"], { "git.status": () => GitFixtures.status([], null, { fingerprint }).toJson() });
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));
    const folders: readonly string[] = ["/work/a", "/work/b", "/work/c", "/work/d", "/work/e"];

    const fetched: Promise<void> = summaries.fetchAllAsync(folders);
    const firstFour: ((answer: JsonValue | Error) => void)[] = [];
    for (let fetch: number = 0; fetch < 4; fetch++)
      firstFour.push(await held.nextAsync("git.fetch"));
    const fetching: readonly (boolean | undefined)[] = folders.map(t => summaries.summaryOf(t)()?.isFetching);
    const beforeAnswers: number = callsOf(context, "git.fetch");
    fingerprint = "f2";
    firstFour.forEach((answer, index) => answer(index === 1 ? GitFixtures.failure(FailureCode.Unavailable, null, "The remote didn't answer.") : null));
    await held.answerAsync("git.fetch", null);
    await fetched;

    expect([fetching, beforeAnswers]).toEqual([[true, true, true, true, undefined], 4]);
    expect(context.callsOf("requestAsync").filter(t => t[0] === "git.fetch").map(t => t[1])).toEqual(folders.map(t => ({ folder: t, basedOn: t === "/work/e" ? "f2" : "f1" })));
    expect(folders.map(t => [summaries.summaryOf(t)()?.isFetching, summaries.summaryOf(t)()?.failure])).toEqual([
      [false, null], [false, "The remote didn't answer."], [false, null], [false, null], [false, null]
    ]);
  });

  it("starts no second fetch of a folder being fetched, and shows a watched read during a fetch as fetching", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.fetch"], { ...GitFixtures.watching, "git.status": GitFixtures.status().toJson() });
    const summaries: GitRepositorySummaries = disposedAfter(new GitRepositorySummaries(context));
    const summary: Signal<GitRepositorySummary | null> = summaries.summaryOf(folder);

    const fetched: Promise<void> = summaries.fetchAllAsync([folder]);
    const settle: (answer: JsonValue | Error) => void = await held.nextAsync("git.fetch");
    await summaries.fetchAllAsync([folder]);
    summaries.watch(folder);
    const during: GitRepositorySummary = await shownAsync(summary, t => t.isFetching && callsOf(context, "git.status") === 2);
    settle(null);
    await fetched;

    expect([during.isFetching, callsOf(context, "git.fetch"), summary()?.isFetching]).toEqual([true, 1, false]);
  });

  it("stops following changes and watching every folder when it is disposed", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { ...GitFixtures.watching, "git.status": status });
    const summaries: GitRepositorySummaries = new GitRepositorySummaries(context);
    summaries.watch("/work/a");
    summaries.watch("/work/b");
    await shownAsync(summaries.summaryOf("/work/b"), () => true);

    summaries.dispose();
    context.raiseEvent("git.changed", { folder: "/work/a" });

    expect(context.callsOf("requestAsync").filter(t => t[0] === "git.unwatch").map(t => t[1])).toEqual([{ folder: "/work/a" }, { folder: "/work/b" }]);
    expect(callsOf(context, "git.status")).toBe(2);
  });
});
