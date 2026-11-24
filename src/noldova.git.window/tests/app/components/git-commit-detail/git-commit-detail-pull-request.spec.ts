/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { LinkPlace } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import type { JsonValue } from "@noldova/context.json";
import { GitCommit, GitCommitDetail, GitGraphCommit, GitRemote, LineKind, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitPullRequestState } from "../../../../src/app/enums/git-pull-request-state.ts";
import type { IGitPullRequests } from "../../../../src/app/interfaces/i-git-pull-requests.ts";
import { GitBranchPullRequest } from "../../../../src/app/models/git-branch-pull-request.ts";
import { GitCommitComments } from "../../../../src/app/models/git-commit-comments.ts";
import { GitCommitView } from "../../../../src/app/models/git-commit-view.ts";
import { GitPullRequestRow } from "../../../../src/app/models/git-pull-request-row.ts";
import { GitPullRequests } from "../../../../src/app/services/git-pull-requests.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../../fixtures/git-held-requests.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitCommitDetailComponent's pull request", () => {
  const id: string = "c".repeat(40);
  const url: string = "https://github.com/example-owner/example-repository/pull/212";
  const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
  const commit: GitGraphCommit = new GitGraphCommit(new GitCommit(id, ["d".repeat(40)], "Sample Author", "2026-11-20T14:02:00Z", "Follow renames"), "author@example.com", []);
  const rowOf = (approvals: number, passed: number, failing: number, pending: number): GitPullRequestRow =>
    new GitPullRequestRow("pull-212", "#212", "Follow renames in the history", url, false, approvals, passed, failing, pending, "fix/rename-detection");
  const answersOf = (shown: GitRemote | null): Readonly<Record<string, JsonValue>> => ({
    ...GitFixtures.watching, "git.status": GitFixtures.status([], null, { remote: shown }).toJson(), "git.diff": GitFixtures.diff("src/a.ts", [LineKind.Added, "one"]).toJson(),
    "git.commitDetail": new GitCommitDetail(id, "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson()
  });
  const provide = (host: Partial<IGitPullRequests>): void => {
    onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "git-github.account", listFor: () => signal(null), refresh: () => undefined, ...host
    }));
  };
  const showAsync = async (shown: GitRemote | null): Promise<GitViewFixture> => {
    onTestFinished(() => GitViewing.commit.set(null));
    GitViewing.commit.set(new GitCommitView(GitFixtures.folder, commit));
    return await GitViewFixture.renderCommitAsync(answersOf(shown), ".detail .files");
  };
  const handledBy = (): WritableSignal<string[]> => {
    const handled: WritableSignal<string[]> = signal<string[]>([]);
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.update(t => [...t, String(error)]));
    return handled;
  };
  const cardOf = (view: GitViewFixture): readonly (readonly string[])[] =>
    view.all(".pull-request-head, .pull-request-note").map(t => (t.children.length === 0 ? [t] : [...t.children]).map(u => (u.textContent ?? "").trim()));

  it("asks the remote's host for the pull request that brought the commit in, and shows it under the files with where it stands, its approvals and checks",
    async () => {
      const answer: WritableSignal<GitBranchPullRequest | null> = signal<GitBranchPullRequest | null>(null);
      const asked: string[] = [];
      provide({ commitFor: (folder, shown, commitId) => { asked.push(`${folder} ${shown.path ?? ""} ${commitId}`); return answer; } });
      const view: GitViewFixture = await showAsync(remote);
      view.context.answer("openLinkAsync", () => Promise.resolve());
      const seen: readonly string[] = [...asked];
      const empty: number = view.all(".pull-request").length;

      answer.set(GitBranchPullRequest.of(rowOf(2, 6, 0, 0), GitPullRequestState.Merged, false));
      await view.waitForAsync(".pull-request");
      const card: HTMLElement = view.find(".pull-request");
      const merged = [cardOf(view), card.dataset["state"], card.title];
      await view.clickAsync(".pull-request");
      await view.clickAsync(".pull-request a");
      answer.set(GitBranchPullRequest.of(rowOf(0, 0, 0, 0), GitPullRequestState.Open, false));
      await view.untilAsync(() => view.find(".pull-request").dataset["state"] === GitPullRequestState.Open);
      const open = cardOf(view);
      answer.set(GitBranchPullRequest.none(1, 0, 0));
      await view.untilAsync(() => view.all(".pull-request").length === 0);

      expect([seen, empty]).toEqual([[`${GitFixtures.folder} example-owner/example-repository ${id}`], 0]);
      expect(merged).toEqual([[["alt_route", "Pull request #212", "Merged"], ["2 approvals · 6 of 6 checks passed"]], "Merged", "Follow renames in the history"]);
      expect([open, view.context.callsOf("openLinkAsync"), card.tagName, card.querySelector(".pull-request-title a")?.getAttribute("href")]).toEqual([
        [["alt_route", "Pull request #212", "Open"]], [[url, { place: LinkPlace.System }], [url, { place: LinkPlace.System }]], "DIV", url]);
    });

  it("opens the pull request in its host's own page when it has one, else in the browser, reporting a host's open that throws and a link the window couldn't open",
    async () => {
      const opened: string[] = [];
      const answers: readonly (boolean | Error)[] = [true, false, new RangeError("open broke")];
      provide({
        commitFor: () => signal(GitBranchPullRequest.of(rowOf(1, 1, 1, 1), GitPullRequestState.Draft, false)),
        open: (folder, row) => {
          opened.push(`${folder} ${row.key}`);
          const next: boolean | Error = answers[opened.length - 1] ?? false;
          if (next instanceof Error)
            throw next;
          return next;
        }
      });
      const view: GitViewFixture = await showAsync(remote);
      const handled: WritableSignal<string[]> = handledBy();
      view.context.answer("openLinkAsync", () => Promise.reject(new Error("no browser")));
      await view.waitForAsync(".pull-request");
      const note: readonly (readonly string[])[] = cardOf(view);

      await view.clickAsync(".pull-request");
      await view.clickAsync(".pull-request");
      await view.clickAsync(".pull-request");
      await GitFixtures.untilAsync(() => handled().length === 3);

      expect(note).toEqual([["alt_route", "Pull request #212", "Draft"], ["1 approval · 1 of 3 checks failed"]]);
      expect([opened.length, view.context.callsOf("openLinkAsync").length, [...handled()].sort()]).toEqual([3, 2, ["Error: no browser", "Error: no browser", "RangeError: open broke"]]);
    });

  it("ends the card's note with the commit's review comments, after its approvals and checks or alone without them, opening their page rather than the pull request's",
    async () => {
      const comments: string = `${url}#discussion_r7`;
      const answer: WritableSignal<GitBranchPullRequest | null> = signal<GitBranchPullRequest | null>(GitBranchPullRequest.of(rowOf(2, 6, 0, 0), GitPullRequestState.Merged, false));
      provide({ commitFor: () => answer, commentsFor: () => signal(new GitCommitComments(3, false, comments)) });
      const view: GitViewFixture = await showAsync(remote);
      view.context.answer("openLinkAsync", () => Promise.resolve());
      await view.waitForAsync(".pull-request-note .pull-request-comments");
      const merged: readonly string[] = view.texts(".pull-request-note");

      await view.clickAsync(".pull-request-comments");
      answer.set(GitBranchPullRequest.of(rowOf(0, 0, 0, 0), GitPullRequestState.Open, false));
      await view.untilAsync(() => view.find(".pull-request").dataset["state"] === GitPullRequestState.Open);

      expect([merged, view.texts(".pull-request-note"), view.all(".comments").length, view.context.callsOf("openLinkAsync")]).toEqual([
        ["2 approvals · 6 of 6 checks passed · 3 review comments on this commit"], ["3 review comments on this commit"], 0, [[comments, { place: LinkPlace.System }]]]);
    });

  const quiet: readonly (readonly [string, GitRemote | null, Partial<IGitPullRequests>])[] = [
    ["the status names no remote", null, { commitFor: () => signal(GitBranchPullRequest.of(rowOf(0, 0, 0, 0), GitPullRequestState.Open, false)) }],
    ["no host claims the remote", new GitRemote("nas", "nas.home", "notes", RemoteTransport.Ssh), {}],
    ["the host reads no commit's pull request", remote, {}],
    ["the host has no answer yet", remote, { commitFor: () => signal(null) }],
    ["no pull request brought the commit in", remote, { commitFor: () => signal(GitBranchPullRequest.none(3, 0, 0)) }],
    ["the host can't read it", remote, { commitFor: () => signal(GitBranchPullRequest.failed("Rate limited.")) }]
  ];

  it.each(quiet)("shows no card when %s", async (_, shown, host) => {
    provide(host);
    const view: GitViewFixture = await showAsync(shown);

    expect(view.all(".pull-request")).toHaveLength(0);
  });

  it("reports a host whose read throws and shows no card", async () => {
    provide({ commitFor: () => { throw new RangeError("read broke"); } });
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync(answersOf(remote), ".empty-view");
    const handled: string[] = [];
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(String(error)));
    onTestFinished(() => GitViewing.commit.set(null));
    GitViewing.commit.set(new GitCommitView(GitFixtures.folder, commit));
    await view.waitForAsync(".detail .files");

    expect([handled, view.all(".pull-request").length]).toEqual([["RangeError: read broke"], 0]);
  });

  it("asks nothing while another folder's status is read, then asks for that folder's remote", async () => {
    const asked: string[] = [];
    provide({ commitFor: folder => { asked.push(folder); return signal(GitBranchPullRequest.of(rowOf(0, 1, 0, 0), GitPullRequestState.Merged, false)); } });
    const view: GitViewFixture = await showAsync(remote);
    const held: GitHeldRequests = new GitHeldRequests(view.context, ["git.status"], answersOf(remote));
    const other: string = "/work/other";

    GitViewing.commit.set(new GitCommitView(other, commit));
    view.folder.set(other);
    await view.untilAsync(() => view.all(".pull-request").length === 0);
    const before: readonly string[] = [...asked];
    // The Git panel and the Commit view each read the folder's status.
    await held.answerAsync("git.status", GitFixtures.status([], null, { remote }).toJson());
    await held.answerAsync("git.status", GitFixtures.status([], null, { remote }).toJson());
    await view.waitForAsync(".pull-request");

    expect([before, asked]).toEqual([[GitFixtures.folder], [GitFixtures.folder, other]]);
    expect(cardOf(view)).toEqual([["alt_route", "Pull request #212", "Merged"], ["1 of 1 checks passed"]]);
  });
});
