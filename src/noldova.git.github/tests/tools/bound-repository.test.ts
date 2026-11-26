/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { FailureCode } from "@noldova/desktop.protocol";
import { ServiceMissingException, ToolFailureCode } from "@noldova/desktop.runtime";
import { GitFolderBinding, type GitStatus } from "@noldova/git.protocol";
import { afterEach, describe, it, vi } from "vitest";

import { FakeGitHub } from "../fixtures/fake-github.fixture.ts";
import { statusOf } from "../fixtures/fake-tools.fixture.ts";
import { failureOf, folder, forkRig, gitFailure, PrToolsRig, textOf } from "../fixtures/pr-tools.fixture.ts";

describe("BoundRepository", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes on a failure to read the bound folder that isn't the binding's, rather than calling it no folder", async () => {
    vi.spyOn(GitFolderBinding, "fromBindings").mockImplementation(() => {
      throw new RangeError("Unexpected.");
    });

    const outcome = await new PrToolsRig().checksAsync();

    assert.deepEqual(failureOf(outcome), [ToolFailureCode.Unavailable, "git-github.internal"]);
  });

  it("reads origin's pull requests when the branch tracks upstream or tracks no remote of two", async () => {
    const rigs = [forkRig(true), forkRig(false)];
    for (const rig of rigs)
      rig.github.answer(FakeGitHub.json([]));

    const outcomes = await Promise.all(rigs.map(t => t.checksAsync()));

    const none = { pullRequest: null, checks: [], reviewDecision: null, approvals: null };
    assert.deepEqual(outcomes.map(t => textOf(t).toJson()), [none, none]);
    assert.deepEqual(rigs.map(t => [t.github.urls(), t.repositories.remoteReads]), [true, false].map(() => [
      ["https://api.github.com/repos/monalisa/hello-world/pulls?head=monalisa%3Afix-bug&state=all&per_page=1"], [[folder, "origin"]]]));
  });

  it("refuses a session without a usable folder, outside a repository, with no branch or with no remote on github.com, without asking GitHub", async () => {
    const answers: readonly GitStatus[] = [statusOf(null), statusOf("fix-bug", null, null), statusOf("fix-bug", "gitlab.com", "octocat/hello-world"),
      statusOf("fix-bug", "github.com", "octocat/tools/hello-world"), statusOf("fix-bug", null, "srv/hello-world.git"), statusOf("fix-bug", "github.com", null)];
    const outcomes = [await new PrToolsRig("gho_token", undefined, {}).checksAsync(), await new PrToolsRig("gho_token", undefined, { "git.folder": "hello-world" }).checksAsync()];
    const outside = new PrToolsRig();
    outside.repositories.answer = gitFailure(FailureCode.NotFound);
    outcomes.push(await outside.checksAsync());
    for (const answer of answers) {
      const rig = new PrToolsRig();
      rig.repositories.answer = answer;
      outcomes.push(await rig.checksAsync());
    }

    assert.deepEqual(outcomes.map(failureOf), [[ToolFailureCode.Refused, "git-github.noFolder"], [ToolFailureCode.Refused, "git-github.noFolder"],
      [ToolFailureCode.Refused, "git-github.notRepository"], [ToolFailureCode.Refused, "git-github.detachedHead"], [ToolFailureCode.Refused,
        "git-github.notGitHub"], [ToolFailureCode.Refused, "git-github.notGitHub"], [ToolFailureCode.Refused, "git-github.notGitHub"],
      [ToolFailureCode.Refused, "git-github.notGitHub"], [ToolFailureCode.Refused, "git-github.notGitHub"]]);
  });

  it("fails as Unavailable when the Git module isn't active, git fails or the read fails another way, without asking GitHub", async () => {
    const inactive = new PrToolsRig("gho_token", () => {
      throw new ServiceMissingException("git.repositories");
    });
    const failing = new PrToolsRig();
    failing.repositories.answer = gitFailure(FailureCode.Internal);
    const broken = new PrToolsRig();
    broken.repositories.answer = new Error("The read broke.");

    const outcomes = [await inactive.checksAsync(), await failing.checksAsync(), await broken.checksAsync()];

    assert.deepEqual(outcomes.map(failureOf), [[ToolFailureCode.Unavailable, "git-github.gitUnavailable"], [ToolFailureCode.Unavailable,
      "git-github.gitUnavailable"], [ToolFailureCode.Unavailable, "git-github.internal"]]);
    assert.equal(inactive.github.requests.length + failing.github.requests.length + broken.github.requests.length, 0);
  });
});
