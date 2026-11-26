/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import type { IGitPullRequests } from "../../../src/app/interfaces/i-git-pull-requests.ts";
import { GitBranchPullRequest } from "../../../src/app/models/git-branch-pull-request.ts";
import { GitRepositorySummary } from "../../../src/app/models/git-repository-summary.ts";
import { GitWorkspaceHost } from "../../../src/app/models/git-workspace-host.ts";
import { GitWorkspaceRow } from "../../../src/app/models/git-workspace-row.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitWorkspaceHost", () => {
  const hostOf = (hostName: string, host: string): IGitPullRequests =>
    ({ claims: t => t.host === host, hostName, signInPage: `${hostName}.account`, listFor: () => signal(null), refresh: () => undefined });
  const github: IGitPullRequests = hostOf("GitHub", "github.com");
  const azure: IGitPullRequests = hostOf("Azure DevOps", "dev.azure.com");
  const rowOf = (remote: GitRemote | null, shown: GitBranchPullRequest | null | undefined = undefined, isRead: boolean = true): GitWorkspaceRow =>
    new GitWorkspaceRow("/work/r", signal(new GitRepositorySummary("/work/r", isRead ? GitFixtures.status([], null, { remote }) : null, false, null)), signal(shown), signal(false));
  const listOf = (rows: readonly GitWorkspaceRow[]): readonly (readonly unknown[])[] =>
    GitWorkspaceHost.listOf(rows, remote => [github, azure].find(t => t.claims(remote)) ?? null).map(t => [t.key, t.name, t.host?.hostName ?? null, t.detail, t.tone]);
  const remoteOf = (host: string | null, path: string | null, transport: RemoteTransport = RemoteTransport.Https): GitRemote => new GitRemote("origin", host, path, transport);

  it("lists each host of the rows' remotes in the order of its first row, signed in once a read answers, then the remotes no host claims by transport", () => {
    const rows: readonly GitWorkspaceRow[] = [
      rowOf(remoteOf("nas.home", "notes", RemoteTransport.Ssh)), rowOf(remoteOf("dev.azure.com", "org/app")), rowOf(remoteOf("github.com", "a/b"), GitBranchPullRequest.none(0, 0, 0)),
      rowOf(remoteOf("github.com", "a/b"), null), rowOf(remoteOf("dev.azure.com", "org/web")), rowOf(remoteOf("nas.home", "music", RemoteTransport.Ssh)),
      rowOf(remoteOf(null, null, RemoteTransport.File)), rowOf(null), rowOf(remoteOf("github.com", "c/d"), undefined, false)
    ];

    expect(listOf(rows)).toEqual([
      ["host Azure DevOps", "Azure DevOps", "Azure DevOps", "2 remotes", "none"], ["host GitHub", "GitHub", "GitHub", "signed in", "ok"],
      ["Ssh", "Plain Git over SSH", null, "2 remotes", "none"], ["File", "Plain Git in a folder", null, "1 remote", "none"]
    ]);
    expect(listOf([])).toEqual([]);
  });

  it("asks for a sign-in when any row's read finds nobody signed in, and counts the remotes of a host that answered nothing or failed", () => {
    expect(listOf([rowOf(remoteOf("github.com", "a/b"), GitBranchPullRequest.none(0, 0, 0)), rowOf(remoteOf("github.com", "c/d"), GitBranchPullRequest.signedOut()),
      rowOf(remoteOf("dev.azure.com", "org/app"), GitBranchPullRequest.failed("No answer.")), rowOf(remoteOf("example.org", "x", RemoteTransport.Other)),
      rowOf(remoteOf("example.org", "y", RemoteTransport.Https))]))
      .toEqual([["host GitHub", "GitHub", "GitHub", "Sign in", "signed-out"], ["host Azure DevOps", "Azure DevOps", "Azure DevOps", "1 remote", "none"],
        ["Other", "Plain Git", null, "1 remote", "none"], ["Https", "Plain Git over HTTPS", null, "1 remote", "none"]]);
  });
});
