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

import type { IGitPullRequests } from "../../../../src/app/interfaces/i-git-pull-requests.ts";
import { GitCommitComments } from "../../../../src/app/models/git-commit-comments.ts";
import { GitCommitView } from "../../../../src/app/models/git-commit-view.ts";
import { GitPullRequests } from "../../../../src/app/services/git-pull-requests.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

describe("GitCommitDetailComponent's review comments", () => {
  const id: string = "c".repeat(40);
  const url: string = "https://github.com/example-owner/example-repository/pull/212#discussion_r7";
  const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
  const commit: GitGraphCommit = new GitGraphCommit(new GitCommit(id, ["d".repeat(40)], "Sample Author", "2026-11-20T14:02:00Z", "Follow renames"), "author@example.com", []);
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
  const rowOf = (view: GitViewFixture): readonly string[] => [...view.find(".comments").children].map(t => (t.textContent ?? "").trim());

  it("asks the remote's host for the commit's review comments once, shows how many above none, and opens their page in the browser", async () => {
    const answer: WritableSignal<GitCommitComments | null> = signal<GitCommitComments | null>(null);
    const asked: string[] = [];
    provide({ commentsFor: (folder, shown, commitId) => { asked.push(`${folder} ${shown.path ?? ""} ${commitId}`); return answer; } });
    const view: GitViewFixture = await showAsync(remote);
    view.context.answer("openLinkAsync", () => Promise.resolve());
    const empty: number = view.all(".comments").length;

    answer.set(new GitCommitComments(3, false, url));
    await view.waitForAsync(".comments");
    const three: readonly string[] = rowOf(view);
    await view.clickAsync(".comments");
    const rows: (readonly string[])[] = [];
    for (const [count, isCapped, text] of [[1, false, "1 review comment on this commit"], [100, true, "100+ review comments on this commit"],
      [4, true, "4+ review comments on this commit"]] as const) {
      answer.set(new GitCommitComments(count, isCapped, url));
      await view.untilAsync(() => rowOf(view)[1] === text);
      rows.push(rowOf(view));
    }
    answer.set(new GitCommitComments(0, false, null));
    await view.untilAsync(() => view.all(".comments").length === 0);

    expect([asked, empty, three, view.context.callsOf("openLinkAsync")]).toEqual([[`${GitFixtures.folder} example-owner/example-repository ${id}`], 0,
      ["forum", "3 review comments on this commit"], [[url, { place: LinkPlace.System }]]]);
    expect(rows).toEqual([["forum", "1 review comment on this commit"], ["forum", "100+ review comments on this commit"],
      ["forum", "4+ review comments on this commit"]]);
  });

  const quiet: readonly (readonly [string, GitRemote | null, Partial<IGitPullRequests>])[] = [
    ["the status names no remote", null, { commentsFor: () => signal(new GitCommitComments(2, false, url)) }],
    ["no host claims the remote", new GitRemote("nas", "nas.home", "notes", RemoteTransport.Ssh), {}],
    ["the host reads no commit's comments", remote, {}],
    ["the host has no answer yet", remote, { commentsFor: () => signal(null) }],
    ["the host counts none", remote, { commentsFor: () => signal(new GitCommitComments(0, false, null)) }],
    ["the host gives no page to open", remote, { commentsFor: () => signal(new GitCommitComments(2, false, null)) }]
  ];

  it.each(quiet)("shows no comments row when %s", async (_, shown, host) => {
    provide(host);
    const view: GitViewFixture = await showAsync(shown);

    expect(view.all(".comments")).toHaveLength(0);
  });

  it("reports a host whose comments read throws and shows no row", async () => {
    provide({ commentsFor: () => { throw new RangeError("read broke"); } });
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync(answersOf(remote), ".empty-view");
    const handled: string[] = [];
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(String(error)));
    onTestFinished(() => GitViewing.commit.set(null));
    GitViewing.commit.set(new GitCommitView(GitFixtures.folder, commit));
    await view.waitForAsync(".detail .files");

    expect([handled, view.all(".comments").length]).toEqual([["RangeError: read broke"], 0]);
  });

  it("reports a page the window couldn't open", async () => {
    provide({ commentsFor: () => signal(new GitCommitComments(2, false, url)) });
    const view: GitViewFixture = await showAsync(remote);
    const handled: string[] = [];
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(String(error)));
    view.context.answer("openLinkAsync", () => Promise.reject(new Error("no browser")));

    await view.waitForAsync(".comments");
    await view.clickAsync(".comments");
    await GitFixtures.untilAsync(() => handled.length === 1);

    expect([handled, view.context.callsOf("openLinkAsync")]).toEqual([["Error: no browser"], [[url, { place: LinkPlace.System }]]]);
  });
});
