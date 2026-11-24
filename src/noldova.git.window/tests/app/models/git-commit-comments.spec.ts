/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitCommitComments } from "../../../src/app/models/git-commit-comments.ts";

describe("GitCommitComments", () => {
  it("keeps a commit's comment count, whether the host capped it, and the page that shows them", () => {
    const capped: GitCommitComments = new GitCommitComments(100, true, "https://github.com/octocat/hello-world/commit/7fd1a60");
    const none: GitCommitComments = new GitCommitComments(0, false, null);

    expect([[capped.count, capped.isCapped, capped.url], [none.count, none.isCapped, none.url]]).toEqual([[100, true,
      "https://github.com/octocat/hello-world/commit/7fd1a60"], [0, false, null]]);
  });
});
