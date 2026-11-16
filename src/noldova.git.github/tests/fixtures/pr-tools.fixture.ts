/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonException, type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { Failure, type FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException, ToolFailure, type ToolFailureCode, ToolResult, type ToolSession } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { type GitRepositories, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { vi } from "vitest";

import { GitHubApi } from "../../src/services/github-api.ts";
import { GitHubAvatars } from "../../src/services/github-avatars.ts";
import { GitHubReads } from "../../src/services/github-reads.ts";
import { GitHubTools } from "../../src/tools/github-tools.ts";
import { FakeGitHub, FakeToken } from "./fake-github.fixture.ts";
import { FakeAnswerer, FakeRepositories, HEAD } from "./fake-tools.fixture.ts";
import { ServedTools } from "./served-tools.fixture.ts";

export const folder = "/home/monalisa/hello-world";
export const user = { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231" };
export const pull = { number: 2, title: "Fix the bug", state: "open", draft: false, merged_at: null, html_url: "https://github.com/octocat/hello-world/pull/2",
  user, created_at: "2026-11-01T10:00:00Z", comments: 1, additions: 10, deletions: 3, changed_files: 2, head: { ref: "fix-bug", sha: HEAD },
  base: { ref: "main" } };
export const draft: JsonObject = { title: "Fix the bug", base: "main", body: "Fixes #1.", draft: true };

export class PrToolsRig {
  public readonly github: FakeGitHub = new FakeGitHub();
  public readonly token: FakeToken;
  public readonly repositories: FakeRepositories = new FakeRepositories();
  public readonly answerer: FakeAnswerer = new FakeAnswerer();
  public readonly served: ServedTools = new ServedTools();
  public readonly session: ToolSession;

  public constructor(token: string | null = "gho_token", repositories?: () => GitRepositories, bindings: JsonObject = { "git.folder": folder }) {
    this.token = new FakeToken(token);
    this.served.fake.beStrict();
    this.served.permissions.registerAnswerer("app", this.answerer, new FakeModuleLog());
    new GitHubTools(new GitHubReads(new GitHubApi(this.github.fetch), this.token, new GitHubAvatars(this.github.fetch, new FakeModuleLog())), this.token, repositories ?? (() => this.repositories))
      .publish(this.served.fake);
    this.session = this.served.openSession("chat-1", bindings);
  }

  public checksAsync(): Promise<ToolResult | ToolFailure> {
    return this.session.callAsync("git_github_pr_checks", {});
  }

  public createAsync(value: JsonObject = draft, signal?: AbortSignal): Promise<ToolResult | ToolFailure> {
    return this.session.callAsync("git_github_pr_create", value, signal === undefined ? {} : { signal });
  }
}

export const fork: GitRemote = new GitRemote("origin", "github.com", "monalisa/hello-world.git", RemoteTransport.Https);
export const upstream: GitRemote = new GitRemote("upstream", "github.com", "octocat/hello-world.git", RemoteTransport.Https);

export function forkRig(isTracking: boolean): PrToolsRig {
  const rig = new PrToolsRig();
  rig.repositories.answer = new GitStatus("fix-bug", HEAD, null, [], false, "f1", null, isTracking ? upstream : null);
  rig.repositories.remotes.set("origin", fork);
  return rig;
}

export function failureOf(outcome: ToolResult | ToolFailure): readonly [ToolFailureCode, string | null] | null {
  return outcome instanceof ToolFailure ? [outcome.code, outcome.moduleCode] : null;
}

export function textOf(outcome: ToolResult | ToolFailure): JsonReader {
  assert.ok(outcome instanceof ToolResult);
  assert.deepEqual(outcome.content.map(t => [t.origin, t.isUntrusted]), [["https://github.com", true]]);
  return JsonReader.parse(outcome.content[0]?.value ?? "");
}

export function gitFailure(code: FailureCode): MethodFailureException {
  return new MethodFailureException(new Failure(code, "git couldn't read the folder."));
}

export function failTitle(failure: Error): void {
  vi.spyOn(JsonReader.prototype, "readString").mockImplementation(function (this: JsonReader, name: string): string {
    if (name === "title")
      throw failure;
    const value: JsonValue = this.readValue(name);
    if (typeof value !== "string")
      throw new JsonException("expected a string", `${this.path}.${name}`);
    return value;
  });
}
