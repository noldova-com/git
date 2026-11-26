/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { Resources } from "../src/resources.ts";

describe("The Azure DevOps module's Resources", () => {
  it("encodes a repository id from Azure DevOps' answer in every API address it builds, so it stays one part of the path or query", () => {
    const id: string = "site/../other?x=1#top";
    const encoded: string = "site%2F..%2Fother%3Fx%3D1%23top";
    const urls: readonly string[] = [Resources.formatPullRequestUrl("fabrikam", id, 12), Resources.formatBuildsUrl("fabrikam", "web", id, 12), Resources.formatPullRequestCommitsUrl("fabrikam", id, 12),
      Resources.formatPullRequestThreadsUrl("fabrikam", id, 12), Resources.formatPullRequestIterationsUrl("fabrikam", id, 12),
      Resources.formatThreadUrl("fabrikam", id, 12, 3), Resources.formatThreadCommentsUrl("fabrikam", id, 12, 3), Resources.formatReviewersUrl("fabrikam", id, 12),
      Resources.formatReviewerUrl("fabrikam", id, 12, "a1"), Resources.formatPullRequestWorkItemsUrl("fabrikam", id, 12),
      Resources.formatPullRequestCommitPageUrl("fabrikam", id, 12, 251),
      Resources.formatPullRequestChangesUrl("fabrikam", id, 12, 3, 1001), Resources.formatPullRequestConflictsUrl("fabrikam", id, 12, 101)];

    assert.deepEqual(urls.filter(t => !t.includes(encoded) || t.includes(id)), []);
    assert.deepEqual([urls[0], urls[1]], [`https://dev.azure.com/fabrikam/_apis/git/repositories/${encoded}/pullrequests/12?api-version=7.1`,
      `https://dev.azure.com/fabrikam/web/_apis/build/builds?branchName=refs%2Fpull%2F12%2Fmerge&repositoryId=${encoded}&repositoryType=TfsGit&maxBuildsPerDefinition=1&queryOrder=queueTimeDescending&api-version=7.1`]);
  });
});
