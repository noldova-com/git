/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostReference, ReferenceKind } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { GitHubReferenceLink } from "../../../src/app/models/github-reference-link.ts";

describe("GitHubReferenceLink", () => {
  it("holds the reference and its kind, keyed by its text in lower case", () => {
    const reference: HostReference = new HostReference("git-github", "Octocat", "Hello.World_2", 42);
    const link: GitHubReferenceLink = new GitHubReferenceLink(reference, ReferenceKind.PullRequest);

    expect([link.reference, link.kind, link.key]).toEqual([reference, ReferenceKind.PullRequest, "octocat/hello.world_2#42"]);
  });
});
