/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingNames } from "../../src/api/index.ts";

describe("HostingNames", () => {
  it("names each sign-in member after the host module's id", () => {
    const names: readonly string[] = [HostingNames.readSignInMethod, HostingNames.startSignInMethod, HostingNames.cancelSignInMethod,
      HostingNames.signOutMethod, HostingNames.signInChangedEvent].map(t => HostingNames.nameOf("git-github", t));

    assert.deepEqual(names, ["git-github.readSignIn", "git-github.startSignIn", "git-github.cancelSignIn", "git-github.signOut", "git-github.signInChanged"]);
  });

  it("names each pull request member after the host module's id", () => {
    const names: readonly string[] = [HostingNames.readReferenceMethod, HostingNames.readBranchPullRequestMethod, HostingNames.createPullRequestMethod]
      .map(t => HostingNames.nameOf("git-github", t));

    assert.deepEqual(names, ["git-github.readReference", "git-github.readBranchPullRequest", "git-github.createPullRequest"]);
  });
});
