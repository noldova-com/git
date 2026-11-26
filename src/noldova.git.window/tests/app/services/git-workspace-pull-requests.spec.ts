/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal, type Signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitPullRequestState } from "../../../src/app/enums/git-pull-request-state.ts";
import type { IGitPullRequests } from "../../../src/app/interfaces/i-git-pull-requests.ts";
import { GitBranchPullRequest } from "../../../src/app/models/git-branch-pull-request.ts";
import { GitPullRequestList } from "../../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";
import { GitRepositorySummary } from "../../../src/app/models/git-repository-summary.ts";
import { GitWorkspaceReview } from "../../../src/app/models/git-workspace-review.ts";
import { GitWorkspaceReviews } from "../../../src/app/models/git-workspace-reviews.ts";
import { GitWorkspaceRow } from "../../../src/app/models/git-workspace-row.ts";
import { GitPullRequests } from "../../../src/app/services/git-pull-requests.ts";
import { GitWorkspacePullRequests } from "../../../src/app/services/git-workspace-pull-requests.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

class ReportedPullRequests {
  public readonly pullRequests: GitWorkspacePullRequests;
  public readonly reported: unknown[];

  public constructor(pullRequests: GitWorkspacePullRequests, reported: unknown[]) {
    this.pullRequests = pullRequests;
    this.reported = reported;
  }
}

describe("GitWorkspacePullRequests", () => {
  const folder: string = "/work/site";
  const remoteOf = (path: string = "example-owner/site", name: string = "origin"): GitRemote => new GitRemote(name, "github.com", path, RemoteTransport.Https);
  const head: string = "0123456789abcdef0123456789abcdef01234567";
  const moved: string = "fedcba9876543210fedcba9876543210fedcba98";
  const summaryOf = (remote: GitRemote | null, branch: string | null = "main", commit: string = head): GitRepositorySummary =>
    new GitRepositorySummary(folder, GitFixtures.status([], null, { remote, branch, head: commit }), false, null);
  const row: GitPullRequestRow = new GitPullRequestRow("214", "#214", "Draw lanes", "https://github.com/example-owner/site/pull/214", false, 0, 0, 0, 0, "main");
  const textOf = (shown: GitBranchPullRequest | null | undefined): string =>
    Object.isNullOrUndefined(shown) ? String(shown)
      : `${shown.state} ${shown.pullRequest?.label ?? "-"} ${shown.pullRequestState ?? "-"} ${shown.isWaitingForReview} ${shown.passed}/${shown.failing}/${shown.pending}`;

  const setUp = (host: Partial<IGitPullRequests> = {}): ReportedPullRequests => {
    const errors: ErrorHandler = new ErrorHandler();
    const reported: unknown[] = [];
    vi.spyOn(errors, "handleError").mockImplementation(error => reported.push(error));
    onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
      claims: t => t.host === "github.com", hostName: "GitHub", signInPage: "github.account", listFor: () => signal(null), refresh: () => undefined, ...host
    }));
    return new ReportedPullRequests(new GitWorkspacePullRequests(errors), reported);
  };

  const hostOf = (): IGitPullRequests => {
    const found: IGitPullRequests | null = GitPullRequests.of(remoteOf());
    if (Object.isNull(found))
      throw new Error("No host claims the remote.");
    return found;
  };

  it("finds the branch's open pull request in the claiming host's list, nothing while no remote is known or no host claims it, and asks for the list again only for another remote", () => {
    const list: WritableSignal<GitPullRequestList | null> = signal(null);
    const asked: string[] = [];
    const { pullRequests } = setUp({ listFor: (_folder, remote) => {
      asked.push(remote.path ?? "");
      return list;
    } });
    const summary: WritableSignal<GitRepositorySummary | null> = signal(null);
    const shown: Signal<GitBranchPullRequest | null | undefined> = pullRequests.branchOf(folder, summary);
    const draft: GitPullRequestRow = new GitPullRequestRow("3", "#3", "Graph", "https://github.com/example-owner/site/pull/3", true, 0, 1, 0, 2, "feature/graph");

    const seen: string[] = [textOf(shown())];
    summary.set(summaryOf(remoteOf()));
    seen.push(textOf(shown()));
    list.set(GitPullRequestList.ready([row, draft]));
    seen.push(textOf(shown()));
    summary.set(summaryOf(remoteOf(), "feature/graph", moved));
    seen.push(textOf(shown()));
    summary.set(summaryOf(remoteOf(), "fix/typo"));
    seen.push(textOf(shown()));
    summary.set(summaryOf(remoteOf(), null));
    seen.push(textOf(shown()));
    summary.set(summaryOf(remoteOf("example-owner/other")));
    list.set(GitPullRequestList.reading());
    seen.push(textOf(shown()));
    list.set(GitPullRequestList.signedOut());
    seen.push(textOf(shown()));
    list.set(GitPullRequestList.failed("No answer."));
    seen.push(textOf(shown()), String(shown()?.failure));
    summary.set(summaryOf(new GitRemote("origin", "gitlab.com", "example-owner/site", RemoteTransport.Https)));
    seen.push(textOf(shown()));

    expect([seen, asked]).toEqual([[
      "undefined", "null", "Ready #214 Open false 0/0/0", "Ready #3 Draft false 1/0/2", "Ready - - false 0/0/0", "Ready - - false 0/0/0", "Reading - - false 0/0/0",
      "SignedOut - - false 0/0/0", "Failed - - false 0/0/0", "No answer.", "undefined"
    ], ["example-owner/site", "example-owner/other"]]);
  });

  it("answers the claiming host's open list, which the branch's pull request shares with one ask, and none for a host that reads branches", () => {
    const list: WritableSignal<GitPullRequestList | null> = signal(null);
    let asked: number = 0;
    const { pullRequests } = setUp({ listFor: () => {
      asked++;
      return list;
    } });
    const summary: WritableSignal<GitRepositorySummary | null> = signal(summaryOf(remoteOf()));
    const listed: Signal<GitPullRequestList | null | undefined> = pullRequests.listOf(folder, summary);
    const shown: Signal<GitBranchPullRequest | null | undefined> = pullRequests.branchOf(folder, summary, listed);

    const before: readonly unknown[] = [listed(), textOf(shown())];
    list.set(GitPullRequestList.ready([row]));

    expect([before, listed()?.rows, textOf(shown()), asked]).toEqual([[null, "null"], [row], "Ready #214 Open false 0/0/0", 1]);
  });

  it("answers no open list for a host that reads branches", () => {
    const { pullRequests } = setUp({ branchFor: () => signal(null), refreshBranch: () => undefined });

    expect(pullRequests.listOf(folder, signal(summaryOf(remoteOf())))()).toBeUndefined();
  });

  it("answers the claiming host's whole open list for the Open count, a host that reads branches too, asked once for each remote, and none without a claiming host", () => {
    const list: WritableSignal<GitPullRequestList | null> = signal(null);
    const asked: string[] = [];
    const { pullRequests } = setUp({ branchFor: () => signal(null), refreshBranch: () => undefined, listFor: (shown, remote) => {
      asked.push(`${shown} ${remote.name}`);
      return list;
    } });
    const summary: WritableSignal<GitRepositorySummary | null> = signal(summaryOf(remoteOf()));
    const opened: Signal<GitPullRequestList | null | undefined> = pullRequests.openListOf(folder, summary);

    const before: GitPullRequestList | null | undefined = opened();
    list.set(GitPullRequestList.ready([row]));
    const ready: readonly GitPullRequestRow[] | undefined = opened()?.rows;
    summary.set(summaryOf(remoteOf(), "feature/graph", moved));
    opened();
    summary.set(summaryOf(new GitRemote("origin", "gitlab.com", "example-owner/site", RemoteTransport.Https)));
    const unclaimed: GitPullRequestList | null | undefined = opened();
    summary.set(summaryOf(null));

    expect([before, ready, unclaimed, opened(), asked]).toEqual([null, [row], undefined, undefined, ["/work/site origin"]]);
  });

  it("reports a host's open list that throws, taking it as no answer", () => {
    const { pullRequests, reported } = setUp({ listFor: () => {
      throw new Error("list refused");
    } });

    expect([pullRequests.openListOf(folder, signal(summaryOf(remoteOf())))(), reported.map(t => String(t))]).toEqual([null, ["Error: list refused"]]);
  });

  it("finds stacks in a host's stack list, asked once for each remote and read by no branch, else in its open list, and in none for a host with neither", () => {
    const stacks: WritableSignal<GitPullRequestList | null> = signal(null);
    const asked: string[] = [];
    const branchRead: string[] = [];
    const { pullRequests } = setUp({ listFor: () => {
      asked.push("list");
      return signal(GitPullRequestList.ready([row]));
    }, stackListFor: (_folder, shown) => {
      asked.push(`stacks ${shown.path ?? ""}`);
      return stacks;
    }, branchFor: (_folder, _shown, branch) => {
      branchRead.push(branch);
      return signal(GitBranchPullRequest.none(0, 0, 0));
    } });
    const summary: WritableSignal<GitRepositorySummary | null> = signal(summaryOf(remoteOf()));
    const listed: Signal<GitPullRequestList | null | undefined> = pullRequests.listOf(folder, summary);
    const stacked: Signal<GitPullRequestList | null | undefined> = pullRequests.stackListOf(folder, summary, listed);
    const shown: Signal<GitBranchPullRequest | null | undefined> = pullRequests.branchOf(folder, summary, listed);

    const before: GitPullRequestList | null | undefined = stacked();
    stacks.set(GitPullRequestList.ready([row]));
    const read: readonly unknown[] = [stacked()?.rows, textOf(shown()), listed()];
    summary.set(summaryOf(remoteOf(), "feature"));
    stacked();
    summary.set(summaryOf(remoteOf("example-owner/docs")));
    stacked();
    summary.set(summaryOf(null));
    const unknown: GitPullRequestList | null | undefined = stacked();
    summary.set(null);

    expect([before, read, unknown, stacked(), asked, branchRead]).toEqual([null, [[row], "Ready - - false 0/0/0", undefined], undefined, undefined,
      ["stacks example-owner/site", "stacks example-owner/docs"], ["main"]]);
  });

  it("finds stacks in the open list of a host without a stack list", () => {
    const { pullRequests } = setUp({ listFor: () => signal(GitPullRequestList.ready([row])) });

    expect(pullRequests.stackListOf(folder, signal(summaryOf(remoteOf())))()?.rows).toEqual([row]);
  });

  it("finds stacks in no list for a host that reads branches without a stack list", () => {
    const { pullRequests } = setUp({ branchFor: () => signal(null), refreshBranch: () => undefined });

    expect(pullRequests.stackListOf(folder, signal(summaryOf(remoteOf())))()).toBeUndefined();
  });

  it("reports a host's stack list that throws, taking it as no answer", () => {
    const failure: Error = new Error("The host broke.");
    const { pullRequests, reported } = setUp({ branchFor: () => signal(null), stackListFor: () => {
      throw failure;
    } });

    expect([pullRequests.stackListOf(folder, signal(summaryOf(remoteOf())))(), reported]).toEqual([null, [failure]]);
  });

  it("reads the branch's pull request from a host that reads branches, asking again for another branch or head commit, and nothing without a branch", () => {
    const answer: WritableSignal<GitBranchPullRequest | null> = signal(null);
    const asked: string[] = [];
    const { pullRequests } = setUp({
      listFor: () => {
        throw new Error("A host that reads branches isn't asked for its list.");
      },
      branchFor: (shown, remote, branch, commit) => {
        asked.push(`${shown} ${remote.path} ${branch} ${commit?.slice(0, 7)}`);
        return answer;
      }
    });
    const summary: WritableSignal<GitRepositorySummary | null> = signal(summaryOf(remoteOf()));
    const shown: Signal<GitBranchPullRequest | null | undefined> = pullRequests.branchOf(folder, summary);

    const seen: string[] = [textOf(shown())];
    answer.set(GitBranchPullRequest.of(row, GitPullRequestState.Merged, false));
    seen.push(textOf(shown()));
    summary.set(summaryOf(remoteOf()));
    shown();
    summary.set(summaryOf(remoteOf(), "main", moved));
    shown();
    summary.set(summaryOf(remoteOf(), "feature/graph", moved));
    answer.set(GitBranchPullRequest.none(0, 0, 1));
    seen.push(textOf(shown()));
    summary.set(summaryOf(remoteOf(), null));
    seen.push(textOf(shown()));

    expect([seen, asked]).toEqual([
      ["null", "Ready #214 Merged false 0/0/0", "Ready - - false 0/0/1", "undefined"],
      ["/work/site example-owner/site main 0123456", "/work/site example-owner/site main fedcba9", "/work/site example-owner/site feature/graph fedcba9"]
    ]);
  });

  it("asks the host to read its list once for each folder and remote until it forgets, and never without a remote or a claiming host", () => {
    const refreshed: string[] = [];
    const { pullRequests } = setUp({ refresh: (shown, remote) => refreshed.push(`${shown} ${remote.name}`) });

    pullRequests.refreshOnce(folder, null);
    pullRequests.refreshOnce(folder, summaryOf(null));
    pullRequests.refreshOnce(folder, summaryOf(new GitRemote("origin", "gitlab.com", "example-owner/site", RemoteTransport.Https)));
    pullRequests.refreshOnce(folder, summaryOf(remoteOf()));
    pullRequests.refreshOnce(folder, summaryOf(remoteOf(), "feature/graph", moved));
    pullRequests.refreshOnce(folder, summaryOf(remoteOf("example-owner/site", "upstream")));
    pullRequests.forget();
    pullRequests.refreshOnce(folder, summaryOf(remoteOf()));

    expect(refreshed).toEqual(["/work/site origin", "/work/site upstream", "/work/site origin"]);
  });

  it("asks a host that reads branches to read once for each branch and head commit and its list once for each remote until it forgets, and no branch without one", () => {
    const refreshed: string[] = [];
    const listed: string[] = [];
    const { pullRequests } = setUp({
      refresh: (shown, remote) => listed.push(`${shown} ${remote.name}`),
      branchFor: () => signal(null),
      refreshBranch: (shown, remote, branch, commit) => refreshed.push(`${shown} ${remote.name} ${branch} ${commit?.slice(0, 7)}`)
    });

    pullRequests.refreshOnce(folder, summaryOf(remoteOf()));
    pullRequests.refreshOnce(folder, summaryOf(remoteOf()));
    pullRequests.refreshOnce(folder, summaryOf(remoteOf(), "feature/graph"));
    pullRequests.refreshOnce(folder, summaryOf(remoteOf(), "main", moved));
    pullRequests.refreshOnce(folder, summaryOf(remoteOf(), null));
    pullRequests.forget();
    pullRequests.refreshOnce(folder, summaryOf(remoteOf()));

    expect(refreshed).toEqual(["/work/site origin main 0123456", "/work/site origin feature/graph 0123456", "/work/site origin main fedcba9", "/work/site origin main 0123456"]);
    expect(listed).toEqual(["/work/site origin", "/work/site origin"]);
  });

  it("opens a pull request through the host that opens it, and leaves it to the browser for a host without its own page or no host", () => {
    const opened: string[] = [];
    const { pullRequests } = setUp({ open: (shown, pullRequest) => {
      opened.push(`${shown} ${pullRequest.label}`);
      return true;
    } });

    expect([pullRequests.open(folder, summaryOf(remoteOf()), row), pullRequests.open(folder, summaryOf(null), row), pullRequests.open(folder, null, row), opened])
      .toEqual([true, false, false, ["/work/site #214"]]);
  });

  it("leaves a pull request to the browser when its host has no page of its own", () => {
    const { pullRequests } = setUp();

    expect(pullRequests.open(folder, summaryOf(remoteOf()), row)).toBe(false);
  });

  it("gathers the review requests across the repositories in their order, each remote's once, keeping a failed read's rows and saying when one was cut", () => {
    const lists: Map<string, WritableSignal<GitPullRequestList | null>> = new Map([["example-owner/site", signal(null)], ["example-owner/docs", signal(null)]]);
    const asked: string[] = [];
    const host: Partial<IGitPullRequests> = { reviewsFor: remote => {
      asked.push(remote.path ?? "");
      return lists.get(remote.path ?? "") ?? signal(null);
    } };
    const { pullRequests } = setUp(host);
    const docs: GitPullRequestRow = new GitPullRequestRow("docs#9", "#9", "Fix a link", "https://github.com/example-owner/docs/pull/9", true, 0, 0, 0, 0, "");
    const site: WritableSignal<GitRepositorySummary | null> = signal(null);
    const rowOf = (shown: string, summary: WritableSignal<GitRepositorySummary | null>): GitWorkspaceRow => new GitWorkspaceRow(shown, summary, signal(undefined), signal(false));
    const repositories: WritableSignal<readonly GitWorkspaceRow[]> = signal([rowOf("/work/docs", signal(summaryOf(remoteOf("example-owner/docs")))), rowOf("/work/site", site),
      rowOf("/work/site-copy", signal(summaryOf(remoteOf("example-owner/site", "upstream")))), rowOf("/work/notes", signal(summaryOf(null))),
      rowOf("/work/lab", signal(summaryOf(new GitRemote("origin", "gitlab.com", "example-owner/lab", RemoteTransport.Https))))]);
    const reviews: Signal<GitWorkspaceReviews> = pullRequests.reviewsOf(repositories);
    const textOf = (shown: GitWorkspaceReviews): string => `${shown.rows.map(t => `${t.repository} ${t.folder} ${t.row.label}`).join(", ")}${shown.hasMore ? " +" : ""}`;

    const seen: string[] = [textOf(reviews())];
    lists.get("example-owner/docs")?.set(GitPullRequestList.ready([docs]));
    site.set(summaryOf(remoteOf()));
    lists.get("example-owner/site")?.set(GitPullRequestList.ready([row], true));
    seen.push(textOf(reviews()));
    lists.get("example-owner/site")?.set(GitPullRequestList.failed("GitHub's rate limit resets at 12:01.", [row]));
    seen.push(textOf(reviews()));
    lists.get("example-owner/docs")?.set(GitPullRequestList.signedOut());
    seen.push(textOf(reviews()));

    expect([seen, asked]).toEqual([["", "docs /work/docs #9, site /work/site #214 +", "docs /work/docs #9, site /work/site #214", "site /work/site #214"],
      ["example-owner/docs", "example-owner/site", "example-owner/docs", "example-owner/site"]]);
    expect(reviews().rows).toEqual([new GitWorkspaceReview(row, "/work/site", "site", hostOf())]);
  });

  it("asks each repository's host to read its review requests once for each remote until forgotten, and opens one in the host's page or leaves it to the browser",
    () => {
      const asked: string[] = [];
      const opened: string[] = [];
      const { pullRequests } = setUp({ refreshReviews: remote => asked.push(remote.path ?? ""), open: (shown, pullRequest) => {
        opened.push(`${shown} ${pullRequest.label}`);
        return true;
      } });
      const summaries: readonly (GitRepositorySummary | null)[] = [summaryOf(remoteOf()), summaryOf(remoteOf("example-owner/docs")), summaryOf(remoteOf(), "fix"),
        summaryOf(null), null, summaryOf(new GitRemote("origin", "gitlab.com", "example-owner/lab", RemoteTransport.Https))];
      const pageless: IGitPullRequests = { claims: () => true, hostName: "GitHub", signInPage: "github.account", listFor: () => signal(null), refresh: () => undefined };

      pullRequests.refreshReviewsOnce(summaries);
      pullRequests.refreshReviewsOnce(summaries);
      pullRequests.forget();
      pullRequests.refreshReviewsOnce(summaries.slice(0, 1));

      expect([asked, pullRequests.openReview(new GitWorkspaceReview(row, folder, "site", hostOf())),
        pullRequests.openReview(new GitWorkspaceReview(row, folder, "site", pageless)), opened])
        .toEqual([["example-owner/site", "example-owner/docs", "example-owner/site"], true, false, ["/work/site #214"]]);
    });

  it("reports a host's review list, review read or review open that throws, taking it as no answer", () => {
    const failure: Error = new Error("The host broke.");
    const fail = (): never => {
      throw failure;
    };
    const { pullRequests, reported } = setUp({ reviewsFor: fail, refreshReviews: fail, open: fail });

    const reviews: GitWorkspaceReviews = pullRequests.reviewsOf(signal([new GitWorkspaceRow(folder, signal(summaryOf(remoteOf())), signal(undefined), signal(false))]))();
    pullRequests.refreshReviewsOnce([summaryOf(remoteOf())]);
    const opened: boolean = pullRequests.openReview(new GitWorkspaceReview(row, folder, "site", hostOf()));

    expect([reviews, opened, reported]).toEqual([new GitWorkspaceReviews([], false), false, [failure, failure, failure]]);
  });

  it("reports a host's list, branch, read or open that throws, taking it as no answer", () => {
    const failure: Error = new Error("The host broke.");
    const fail = (): never => {
      throw failure;
    };
    const lists = setUp({ listFor: fail, refresh: fail, open: fail });
    const listed: GitBranchPullRequest | null | undefined = lists.pullRequests.branchOf(folder, signal(summaryOf(remoteOf())))();
    lists.pullRequests.refreshOnce(folder, summaryOf(remoteOf()));
    const opened: boolean = lists.pullRequests.open(folder, summaryOf(remoteOf()), row);
    const branches = setUp({ branchFor: fail, refreshBranch: fail });
    const read: GitBranchPullRequest | null | undefined = branches.pullRequests.branchOf(folder, signal(summaryOf(remoteOf())))();
    branches.pullRequests.refreshOnce(folder, summaryOf(remoteOf()));

    expect([listed, opened, lists.reported, read, branches.reported]).toEqual([null, false, [failure, failure, failure], null, [failure, failure]]);
  });
});
