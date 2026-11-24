/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { HostReference, HostReviewRequest } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { ReviewSearch } from "../../src/models/review-search.ts";

describe("ReviewSearch", () => {
  it("keeps the token it searched with, when it started and the search's answer as it settles", async () => {
    const request: HostReviewRequest = new HostReviewRequest(new HostReference("git-github", "octocat", "hello-world", 7), "Fix the build",
      "https://github.com/octocat/hello-world/pull/7", false, 1_700_000_000_000);
    const search: ReviewSearch = new ReviewSearch("gho_token", 1_700_000_000_000, Promise.resolve([[request], true]));

    assert.deepEqual([search.token, search.startedAt, await search.answer], ["gho_token", 1_700_000_000_000, [[request], true]]);
  });

  it("keeps a search that failed, so its failure reaches whoever waits on it", async () => {
    const failure: Error = new Error("GitHub didn't answer.");
    const search: ReviewSearch = new ReviewSearch("gho_token", 0, Promise.reject(failure));

    await assert.rejects(search.answer, failure);
  });
});
