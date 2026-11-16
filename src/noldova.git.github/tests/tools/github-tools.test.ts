/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { describe, it } from "vitest";

import { GitHubApi } from "../../src/services/github-api.ts";
import { GitHubAvatars } from "../../src/services/github-avatars.ts";
import { GitHubReads } from "../../src/services/github-reads.ts";
import { GitHubTools } from "../../src/tools/github-tools.ts";
import { FakeGitHub, FakeToken } from "../fixtures/fake-github.fixture.ts";
import { FakeRepositories } from "../fixtures/fake-tools.fixture.ts";
import { ServedTools } from "../fixtures/served-tools.fixture.ts";

describe("GitHubTools", () => {
  it("registers the read, checks and create tools, and withdraws each once when disposed, so a later call fails as Unavailable without asking GitHub", async () => {
    const github = new FakeGitHub();
    const token = new FakeToken();
    const repositories = new FakeRepositories();
    const served = new ServedTools();
    served.fake.beStrict();
    const tools = new GitHubTools(new GitHubReads(new GitHubApi(github.fetch), token, new GitHubAvatars(github.fetch, new FakeModuleLog())), token, () => repositories);
    tools.publish(served.fake);
    const session = served.openSession("chat-1", { "git.folder": "/home/monalisa/hello-world" });
    const offered = session.listTools().map(t => t.name);

    tools.dispose();
    tools.dispose();
    const outcome = await session.callAsync("git_github_read", { owner: "octocat", repository: "hello-world", number: 1 });

    assert.deepEqual(offered, ["git_github_read", "git_github_pr_checks", "git_github_pr_create"]);
    assert.deepEqual([session.listTools().length, outcome instanceof ToolFailure ? outcome.code : null, github.requests.length,
      served.fake.activeCallsOf("register")], [0, ToolFailureCode.Unavailable, 0, []]);
  });
});
