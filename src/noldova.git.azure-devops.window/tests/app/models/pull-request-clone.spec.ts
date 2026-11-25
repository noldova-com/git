/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { GitRemote, GitStatus, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { PullRequestClone } from "../../../src/app/models/pull-request-clone.ts";

const URL: string = "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/752";

function remote(host: string | null, path: string | null, transport: RemoteTransport = RemoteTransport.Https): GitRemote {
  return new GitRemote("origin", host, path, transport);
}

function statusOf(branch: string | null, upstream: string | null, clone: GitRemote | null = remote("dev.azure.com", "fabrikam/Web%20Site/_git/site")): GitStatus {
  return new GitStatus(branch, "a".repeat(40), Object.isNull(upstream) ? null : new StatusUpstream(upstream, 0, 1, false), [], false, "f", null, clone);
}

describe("PullRequestClone", () => {
  it("knows a clone of the pull request's repository by its web, SSH or older address, ignoring case", () => {
    const remotes: readonly GitRemote[] = [remote("dev.azure.com", "fabrikam/Web%20Site/_git/site"), remote("dev.azure.com", "Fabrikam/web%20site/_git/Site"),
      remote("ssh.dev.azure.com", "v3/fabrikam/Web%20Site/site", RemoteTransport.Ssh), remote("fabrikam.visualstudio.com", "Web%20Site/_git/site"),
      remote("fabrikam.visualstudio.com", "DefaultCollection/Web%20Site/_git/site")];

    expect(remotes.map(t => PullRequestClone.isCloneOf(t, URL))).toEqual(remotes.map(() => true));
  });

  it("knows no clone of another organization, project or repository, another host, no remote, or a page address it doesn't read", () => {
    const remotes: readonly (GitRemote | null)[] = [remote("dev.azure.com", "contoso/Web%20Site/_git/site"), remote("dev.azure.com", "fabrikam/Web/_git/site"),
      remote("dev.azure.com", "fabrikam/Web%20Site/_git/site-api"), remote("github.com", "fabrikam/site"), remote("dev.azure.com", null), remote(null, null), null];

    expect(remotes.map(t => PullRequestClone.isCloneOf(t, URL))).toEqual(remotes.map(() => false));
    expect(["https://dev.azure.com/fabrikam/Web%20Site/_git/site", "https://dev.azure.com/fabrikam/Web%20Site/_git/%E0%A4%A/pullrequest/752"]
      .map(t => PullRequestClone.isCloneOf(remote("dev.azure.com", "fabrikam/Web%20Site/_git/site"), t))).toEqual([false, false]);
  });

  it("pulls into a clone on the target branch that tracks that branch on its own remote, and no other", () => {
    const statuses: readonly GitStatus[] = [statusOf("feature", "origin/feature"), statusOf("main", null), statusOf("main", "origin/release"),
      statusOf("main", "upstream/main"), statusOf("main", "origin/main", null), statusOf("main", "origin/main", remote("dev.azure.com", "contoso/Web%20Site/_git/site"))];

    expect([PullRequestClone.isPullTarget(statusOf("main", "origin/main"), URL, "main"), statuses.map(t => PullRequestClone.isPullTarget(t, URL, "main"))])
      .toEqual([true, statuses.map(() => false)]);
  });
});
