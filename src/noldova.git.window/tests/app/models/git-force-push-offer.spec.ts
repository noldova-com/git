/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitForcePushOffer } from "../../../src/app/models/git-force-push-offer.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitForcePushOffer", () => {
  const id: string = "89abcdef0123456789abcdef0123456789abcdef";

  it("offers to replace the upstream's commit the status shows while the upstream is ahead", () => {
    expect(GitForcePushOffer.of(GitFixtures.status([], new StatusUpstream("origin/main", 1, 2, false, id))))
      .toEqual(new GitForcePushOffer("main", "origin/main", id));
  });

  it("offers nothing without a status, a branch, an upstream ahead or the upstream's commit", () => {
    expect([
      GitForcePushOffer.of(null),
      GitForcePushOffer.of(GitFixtures.status([], new StatusUpstream("origin/main", 0, 2, false, id), { branch: null })),
      GitForcePushOffer.of(GitFixtures.status([], null)),
      GitForcePushOffer.of(GitFixtures.status([], new StatusUpstream("origin/main", 1, 0, false, id))),
      GitForcePushOffer.of(GitFixtures.status([], new StatusUpstream("origin/main", 1, 2, false)))
    ]).toEqual([null, null, null, null, null]);
  });
});
