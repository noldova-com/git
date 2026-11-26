/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { GitRemote, RemoteTransport } from "@noldova/git.protocol";

import { GitPullRequestsState } from "../enums/git-pull-requests-state.ts";
import type { IGitPullRequests } from "../interfaces/i-git-pull-requests.ts";
import { Resources } from "../../resources.ts";
import type { GitWorkspaceRow } from "./git-workspace-row.ts";
import { GitHostTally } from "./git-host-tally.ts";

export class GitWorkspaceHost {
  public readonly key: string;
  public readonly name: string;
  public readonly host: IGitPullRequests | null;
  public readonly detail: string;
  public readonly tone: string;

  private constructor(key: string, name: string, host: IGitPullRequests | null, detail: string, tone: string) {
    this.key = key;
    this.name = name;
    this.host = host;
    this.detail = detail;
    this.tone = tone;
  }

  public static listOf(rows: readonly GitWorkspaceRow[], hostOf: (remote: GitRemote) => IGitPullRequests | null): readonly GitWorkspaceHost[] {
    const hosts: Map<IGitPullRequests, GitHostTally> = new Map();
    const plain: Map<RemoteTransport, Set<string>> = new Map();
    for (const row of rows) {
      const remote: GitRemote | null = row.summary()?.remote ?? null;
      if (Object.isNull(remote))
        continue;
      const key: string = JSON.stringify([remote.host, remote.path]);
      const host: IGitPullRequests | null = hostOf(remote);
      if (Object.isNull(host)) {
        plain.set(remote.transport, (plain.get(remote.transport) ?? new Set()).add(key));
        continue;
      }
      const tally: GitHostTally = hosts.get(host) ?? new GitHostTally();
      tally.add(key, row.hostState());
      hosts.set(host, tally);
    }
    return [
      ...[...hosts].map(([host, tally]) => GitWorkspaceHost.ofHost(host, tally.remotes.size, tally.states)),
      ...[...plain].map(([transport, remotes]) => new GitWorkspaceHost(transport, Resources.plainGitHosts[transport], null, Resources.formatRemoteCount(remotes.size), "none"))
    ];
  }

  private static ofHost(host: IGitPullRequests, remotes: number, states: ReadonlySet<GitPullRequestsState | null>): GitWorkspaceHost {
    if (states.has(GitPullRequestsState.SignedOut))
      return new GitWorkspaceHost(`host ${host.hostName}`, host.hostName, host, Resources.hostSignIn, "signed-out");
    if (states.has(GitPullRequestsState.Ready))
      return new GitWorkspaceHost(`host ${host.hostName}`, host.hostName, host, Resources.hostSignedIn, "ok");
    return new GitWorkspaceHost(`host ${host.hostName}`, host.hostName, host, Resources.formatRemoteCount(remotes), "none");
  }
}
