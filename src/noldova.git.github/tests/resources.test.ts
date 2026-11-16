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

describe("The GitHub module's Resources", () => {
  it("adds the page to a check-run path only after the first page", () => {
    assert.deepEqual([Resources.formatCheckRunsPath("6dcb09b", 1), Resources.formatCheckRunsPath("6dcb09b", 3)],
      ["commits/6dcb09b/check-runs?per_page=100", "commits/6dcb09b/check-runs?per_page=100&page=3"]);
  });

  it("starts a shown body on its own line and builds a repository's API path from its parts", () => {
    assert.deepEqual([Resources.formatBody("Fixes #1."), Resources.formatRepositoryPath("octocat", "hello-world", "pulls/2")],
      ["\nFixes #1.", "/repos/octocat/hello-world/pulls/2"]);
  });

  it("writes the avatar's and the token's fixed log reasons with their limits", () => {
    assert.deepEqual([Resources.avatarTimedOut, Resources.avatarTooLarge, Resources.avatarRedirectedAway, Resources.tokenNotForgotten], [
      "it didn't arrive within 5 seconds", "the image is over 64 KiB", "the avatar server redirected more than 3 times, or off its host",
      "The GitHub token couldn't be removed from this computer's secrets; it is no longer used."]);
  });

  it("names a pull request's request title, draft or not, and its branches", () => {
    assert.deepEqual([Resources.formatCreateRequestTitle("octocat/hello-world", true), Resources.formatCreateRequestTitle("octocat/hello-world", false),
      Resources.formatBranches("fix-bug", "main")],
    ["Open a draft pull request in octocat/hello-world", "Open a pull request in octocat/hello-world", "fix-bug \u2192 main"]);
  });
});
