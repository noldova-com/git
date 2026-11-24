/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitRef, GitRemote, RefKind, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import type { IGitPullRequests } from "../../../src/app/interfaces/i-git-pull-requests.ts";
import { GitPullRequestsState } from "../../../src/app/enums/git-pull-requests-state.ts";
import { GitPullRequestList } from "../../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";
import { GitRefChip } from "../../../src/app/models/git-ref-chip.ts";
import { GitPullRequests } from "../../../src/app/services/git-pull-requests.ts";

describe("GitPullRequests", () => {
  const github: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
  const plain: GitRemote = new GitRemote("nas", "nas.home", "notes", RemoteTransport.Ssh);
  const hostOf = (claims: (remote: GitRemote) => boolean): IGitPullRequests =>
    ({ claims, hostName: "Host", signInPage: "host.account", listFor: () => signal(null), refresh: () => undefined });

  it("gives the first added host that claims the remote, and none once it is removed", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const first: IGitPullRequests = hostOf(t => t.host === "github.com");
    const second: IGitPullRequests = hostOf(() => true);
    const removeFirst: () => void = GitPullRequests.provide(context, first);
    const removeSecond: () => void = GitPullRequests.provide(context, second);

    const found: (IGitPullRequests | null)[] = [GitPullRequests.of(github), GitPullRequests.of(plain)];
    removeSecond();
    found.push(GitPullRequests.of(plain));
    removeFirst();
    found.push(GitPullRequests.of(github));

    expect(found).toEqual([first, second, null, null]);
  });

  it("asks the claiming host for a new pull request's page only with both branches named on the remote, and has none without a remote, a host or its page", () => {
    const labels: GitRefChip[] = GitRefChip.remotesApart(GitRefChip.chipsOf([
      new GitRef(RefKind.Branch, "feature"), new GitRef(RefKind.RemoteBranch, "origin/feature"), new GitRef(RefKind.Branch, "topic"),
      new GitRef(RefKind.RemoteBranch, "upstream/release"), new GitRef(RefKind.Branch, "main")
    ]));
    const labelOf = (branch: string): GitRefChip => labels.find(t => t.branch === branch) ?? new GitRefChip(branch, "", false, false);
    const feature: GitRefChip = labelOf("feature");
    const topic: GitRefChip = labelOf("topic");
    const main: GitRefChip = labelOf("main");
    const other: GitRefChip = labelOf("upstream/release");
    const url = (remote: GitRemote | null, source: GitRefChip, target: GitRefChip): string | null => GitPullRequests.newPullRequestUrlOf(remote, source, labels, target);
    const asked: string[] = [];
    const remove: () => void = GitPullRequests.provide(new FakeWindowPartContext(), {
      ...hostOf(t => t.host === "github.com"),
      newPullRequestUrl: (remote, source, target) => {
        asked.push(`${remote.name} ${source} ${target}`);
        return `https://example.com/${source}...${target}`;
      }
    });
    const removePlain: () => void = GitPullRequests.provide(new FakeWindowPartContext(), hostOf(t => t.host === "nas.home"));
    const pages: (string | null)[] = [
      url(github, feature, main), url(null, feature, main), url(new GitRemote("origin", "gitlab.com", "a/b", RemoteTransport.Https), feature, main),
      url(new GitRemote("origin", "nas.home", "notes", RemoteTransport.Ssh), feature, main), url(github, topic, main), url(github, feature, other)
    ];
    removePlain();
    remove();

    expect([pages, asked]).toEqual([["https://example.com/feature...main", null, null, null, null, null], ["origin feature main"]]);
  });

  it("logs a claim that throws to the part that gave it, and asks the next host", () => {
    const broken: FakeWindowPartContext = new FakeWindowPartContext();
    const next: IGitPullRequests = hostOf(() => true);
    const removeBroken: () => void = GitPullRequests.provide(broken, hostOf(() => { throw new RangeError("broken"); }));
    const removeNext: () => void = GitPullRequests.provide(new FakeWindowPartContext(), next);

    const found: IGitPullRequests | null = GitPullRequests.of(github);
    removeBroken();
    removeNext();

    expect([found, broken.callsOf("log")]).toEqual([next, [["The repository panel passed over a host's pull requests, since its claim failed: RangeError: broken"]]]);
  });
});

describe("GitPullRequestList", () => {
  const row: GitPullRequestRow = new GitPullRequestRow("fabrikam/0f1e/482", "!482", "Export notes as Markdown files", "https://dev.example.com/pr/482", true, 2, 3, 1, 0, "feature/export-notes");

  it("holds each state of a host's read, with its rows or why it failed", () => {
    const lists: GitPullRequestList[] = [
      GitPullRequestList.reading(), GitPullRequestList.reading([row]), GitPullRequestList.ready([row]), GitPullRequestList.signedOut(), GitPullRequestList.failed("No answer.")
    ];

    expect(lists.map(t => [t.state, t.rows, t.failure])).toEqual([
      [GitPullRequestsState.Reading, [], null], [GitPullRequestsState.Reading, [row], null], [GitPullRequestsState.Ready, [row], null],
      [GitPullRequestsState.SignedOut, [], null], [GitPullRequestsState.Failed, [], "No answer."]
    ]);
    expect([row.key, row.label, row.title, row.url, row.isDraft, row.approvals, row.passed, row.failing, row.pending, row.headBranch, row.baseBranch]).toEqual([
      "fabrikam/0f1e/482", "!482", "Export notes as Markdown files", "https://dev.example.com/pr/482", true, 2, 3, 1, 0, "feature/export-notes", null
    ]);
    expect(new GitPullRequestRow("1", "#1", "One", "https://dev.example.com/pr/1", false, 0, 0, 0, 0, "feature/two", "feature/one").baseBranch).toBe("feature/one");
  });
});
