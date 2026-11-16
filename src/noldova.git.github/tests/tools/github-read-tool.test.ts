/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { type JsonObject, JsonReader } from "@noldova/context.json";
import { ToolFailure, ToolFailureCode, ToolResult, ToolRisk, type ToolSession } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { HostItem, HostPerson, HostReference, ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { GitHubApi } from "../../src/services/github-api.ts";
import { GitHubAvatars } from "../../src/services/github-avatars.ts";
import { GitHubReads } from "../../src/services/github-reads.ts";
import { GitHubTools } from "../../src/tools/github-tools.ts";
import { FakeGitHub, FakeToken, linesOf } from "../fixtures/fake-github.fixture.ts";
import { FakeRepositories } from "../fixtures/fake-tools.fixture.ts";
import { ServedTools } from "../fixtures/served-tools.fixture.ts";

const created = "2026-11-01T10:00:00Z";
const user = { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231" };
const issue = { number: 1, title: "Found a bug", state: "open", state_reason: null, html_url: "https://github.com/octocat/hello-world/issues/1", user,
  created_at: created, comments: 2 };
const input: JsonObject = { owner: "octocat", repository: "hello-world", number: 1 };

class Rig {
  public readonly github: FakeGitHub = new FakeGitHub();
  public readonly token: FakeToken;
  public readonly served: ServedTools = new ServedTools();
  public readonly tools: GitHubTools;
  public readonly session: ToolSession;

  public constructor(token: string | null = "gho_token") {
    this.token = new FakeToken(token);
    const repositories = new FakeRepositories();
    this.tools = new GitHubTools(new GitHubReads(new GitHubApi(this.github.fetch), this.token, new GitHubAvatars(this.github.fetch, new FakeModuleLog())), this.token, () => repositories);
    this.served.fake.beStrict();
    this.tools.publish(this.served.fake);
    this.session = this.served.openSession("chat-1", {});
  }

  public readAsync(value: JsonObject = input, signal?: AbortSignal): Promise<ToolResult | ToolFailure> {
    return this.session.callAsync("git_github_read", value, signal === undefined ? {} : { signal });
  }
}

function failureOf(outcome: ToolResult | ToolFailure): readonly [ToolFailureCode, string | null] | null {
  return outcome instanceof ToolFailure ? [outcome.code, outcome.moduleCode] : null;
}

describe("GitHubReadTool", () => {
  it("offers git_github_read as a low-risk, read-only tool that reaches GitHub", () => {
    const rig = new Rig();

    const tool = rig.session.listTools().find(t => t.name === "git_github_read");

    assert.deepEqual([tool?.hints, tool?.risk, tool?.deadline, tool?.resource],
      [{ isReadOnly: true, isDestructive: false, isOpenWorld: true }, { default: ToolRisk.Low, maximum: ToolRisk.Low }, { default: 30_000, maximum: 120_000 },
        null]);
  });

  it("answers the issue as untrusted text from github.com, read with the signed-in account", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(issue));

    const outcome = await rig.readAsync();

    const item = new HostItem(new HostReference("git-github", "octocat", "hello-world", 1), ReferenceKind.Issue, ReferenceState.Open, "Found a bug",
      issue.html_url, new HostPerson("octocat", null, null), Date.parse(created), null, 2, null);
    assert.ok(outcome instanceof ToolResult);
    assert.deepEqual(outcome.content.map(t => [t.origin, t.isUntrusted, JsonReader.parseValue(t.value)]), [["https://github.com", true, item.toJson()]]);
    assert.deepEqual([rig.github.urls(), rig.github.requests[0]?.header("Authorization")],
      [["https://api.github.com/repos/octocat/hello-world/issues/1"], "Bearer gho_token"]);
  });

  it("refuses an owner, repository or number GitHub can't have, and a field it doesn't take, without asking GitHub", async () => {
    const rig = new Rig();

    const outcomes = [
      await rig.readAsync({ ...input, owner: "octo cat" }),
      await rig.readAsync({ ...input, owner: "octocat/../users" }),
      await rig.readAsync({ ...input, repository: ".." }),
      await rig.readAsync({ ...input, repository: "." }),
      await rig.readAsync({ ...input, number: 0 }),
      await rig.readAsync({ ...input, number: 1.5 }),
      await rig.readAsync({ ...input, host: "example.com" }),
      await rig.readAsync({ owner: "octocat", number: 1 })
    ];

    assert.deepEqual(outcomes.map(failureOf), Array.from({ length: 8 }, () => [ToolFailureCode.Refused, null]));
    assert.equal(rig.github.requests.length, 0);
  });

  it("fails as Unavailable, saying to sign in, when signed out or once GitHub refuses the token", async () => {
    const signedOut = new Rig(null);
    const refused = new Rig();
    refused.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401));

    const outcomes = [await signedOut.readAsync(), await refused.readAsync()];

    assert.deepEqual(outcomes.map(failureOf), [[ToolFailureCode.Unavailable, "git-github.signedOut"], [ToolFailureCode.Unavailable,
      "git-github.signedOut"]]);
    assert.deepEqual([signedOut.github.requests.length, refused.token.refused], [0, ["gho_token"]]);
  });

  it("fails as signed out when the sign-in ends while GitHub answers, and drops that answer", async () => {
    const rig = new Rig();
    const release = rig.github.hold();

    const pending = rig.readAsync();
    await rig.github.askedAsync(1);
    rig.token.answer("token", null);
    release(FakeGitHub.json(issue));

    assert.deepEqual(failureOf(await pending), [ToolFailureCode.Unavailable, "git-github.signedOut"]);
  });

  it("ends a cancelled read as Cancelled, leaving GitHub's late answer unread and nothing logged", async () => {
    const rig = new Rig();
    const release = rig.github.hold();
    const cancel = new AbortController();

    const pending = rig.readAsync(input, cancel.signal);
    await rig.github.askedAsync(1);
    cancel.abort();
    const outcome = await pending;
    release(FakeGitHub.json(issue));

    assert.deepEqual([failureOf(outcome), linesOf(rig.served.log)], [[ToolFailureCode.Cancelled, null], []]);
  });

  it("fails as Unavailable when GitHub has no such item for the account, or can't be reached, and as TimedOut when GitHub doesn't answer in time",
    async () => {
      const rig = new Rig();
      rig.github.answer(FakeGitHub.json({ message: "Not Found" }, 404), FakeGitHub.json({ message: "Server Error" }, 500));
      rig.github.fail(new TypeError("fetch failed"));
      rig.github.fail(new DOMException("The operation timed out.", "TimeoutError"));

      const outcomes = [await rig.readAsync(), await rig.readAsync(), await rig.readAsync(), await rig.readAsync()];

      assert.deepEqual(outcomes.map(failureOf), [[ToolFailureCode.Unavailable, "git-github.notFound"], [ToolFailureCode.Unavailable,
        "git-github.unavailable"], [ToolFailureCode.Unavailable, "git-github.unavailable"], [ToolFailureCode.TimedOut, null]]);
    });
});
