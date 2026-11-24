/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { FailureCode, GitBranches, GitRemote, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it, vi } from "vitest";

import { GitBulkResult } from "../../../src/app/models/git-bulk-result.ts";
import { GitBulkTarget } from "../../../src/app/models/git-bulk-target.ts";
import { GitRuntimeClient } from "../../../src/app/services/git-runtime-client.ts";
import { GitWorkspaceBulk } from "../../../src/app/services/git-workspace-bulk.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../fixtures/git-held-requests.fixture.ts";

describe("GitWorkspaceBulk", () => {
  const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/git", RemoteTransport.Https);
  const upstream = (ahead: number, behind: number, name: string = "origin/feature/kit"): StatusUpstream => new StatusUpstream(name, ahead, behind, false);
  const target = (name: string, hasUpstream: boolean = true): GitBulkTarget =>
    new GitBulkTarget(`/work/${name}`, name, "feature/kit", hasUpstream ? "origin/feature/kit" : null, remote);

  /** Answers each folder's status, and each push or pull, from maps by folder; a request this test doesn't list fails it. */
  const contextOf = (statuses: Readonly<Record<string, JsonValue>>, writes: Readonly<Record<string, Error | null>>): FakeWindowPartContext => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("requestAsync", async (method, params) => {
      const reader: JsonReader = JsonReader.fromValue(params);
      const folder: string = reader.readString("folder");
      const answer: JsonValue | Error | null | undefined = method === "git.status" ? statuses[folder] : writes[folder];
      if (answer === undefined)
        throw new Error(`No ${method} for ${folder}.`);
      if (answer instanceof Error)
        throw answer;
      return answer;
    });
    return context;
  };

  const reportedBy = (errors: ErrorHandler): unknown[] => {
    const reported: unknown[] = [];
    vi.spyOn(errors, "handleError").mockImplementation(error => reported.push(error));
    return reported;
  };

  const callsOf = (context: FakeWindowPartContext, method: string): readonly string[] =>
    context.callsOf("requestAsync").filter(t => t[0] === method).map(t => `${JsonReader.fromValue(t[1]).readString("folder")} ${JsonReader.fromValue(t[1]).readString("basedOn")}`);

  it("pushes each branch on a status read just before it, skips one without an upstream unread and one whose branch, upstream or remote changed, and goes on past failures", async () => {
    const status = (branch: string, tracked: StatusUpstream | null, fingerprint: string, place: GitRemote = remote): JsonValue =>
      GitFixtures.status([], tracked, { branch, fingerprint, remote: place }).toJson();
    const kit: StatusUpstream = upstream(1, 0);
    const context: FakeWindowPartContext = contextOf({
      "/work/moved": status("main", kit, "m1"), "/work/lost": status("feature/kit", null, "l1"), "/work/renamed": status("feature/kit", upstream(1, 0, "origin/main"), "r1"),
      "/work/local": status("feature/kit", upstream(1, 0, "main"), "c1"),
      "/work/moved-remote": status("feature/kit", kit, "e1", new GitRemote("origin", "gitlab.com", "example-owner/git", RemoteTransport.Https)),
      "/work/ssh": status("feature/kit", kit, "s1", new GitRemote("origin", "github.com", "example-owner/git", RemoteTransport.Ssh)),
      "/work/ui": status("feature/kit", kit, "u1"), "/work/term": status("feature/kit", kit, "t1"), "/work/odd": status("feature/kit", kit, "o1")
    }, { "/work/ui": null, "/work/term": GitFixtures.failure(FailureCode.Git, null, "The remote refused it."), "/work/odd": new Error("The window went away.") });
    const errors: ErrorHandler = new ErrorHandler();
    const reported: unknown[] = reportedBy(errors);

    const result: GitBulkResult = await new GitWorkspaceBulk(new GitRuntimeClient(context), errors)
      .pushAsync([target("git", false), target("moved"), target("lost"), target("renamed"), target("local"), target("moved-remote"), target("ssh"), target("ui"), target("term"), target("odd")]);

    expect([result.done, result.skipped.map(t => [t.repository, t.reason]), result.failed.map(t => [t.repository, t.reason])]).toEqual([["ui"],
      [["git", "it has no upstream on its remote"], ...["moved", "lost", "renamed", "local", "moved-remote", "ssh"].map(t => [t, "its branch, upstream or remote changed since you confirmed"])],
      [["term", "The remote refused it."], ["odd", "The window went away."]]]);
    expect(context.callsOf("requestAsync").filter(t => t[0] === "git.status").length).toBe(9);
    expect([...callsOf(context, "git.push")].sort()).toEqual(["/work/odd o1", "/work/term t1", "/work/ui u1"]);
    expect(callsOf(context, "git.forcePush")).toEqual([]);
    expect(reported.map(t => t instanceof Error ? t.message : "")).toEqual(["The window went away."]);
  });

  it("pushes at most four repositories at a time", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const held: GitHeldRequests = new GitHeldRequests(context, ["git.push"], { "git.status": GitFixtures.status([], upstream(1, 0), { branch: "feature/kit", remote }).toJson() });
    const pushing: Promise<GitBulkResult> = new GitWorkspaceBulk(new GitRuntimeClient(context), new ErrorHandler())
      .pushAsync(["a", "b", "c", "d", "e"].map(t => target(t)));

    const firstFour: ((answer: JsonValue | Error) => void)[] = [];
    for (let push: number = 0; push < 4; push++)
      firstFour.push(await held.nextAsync("git.push"));
    const beforeAnswers: number = context.callsOf("requestAsync").filter(t => t[0] === "git.push").length;
    for (const answer of firstFour)
      answer(null);
    await held.answerAsync("git.push", null);

    expect([beforeAnswers, (await pushing).done]).toEqual([4, ["a", "b", "c", "d", "e"]]);
  });

  it("pulls each repository still only behind its upstream on a status read just before it, skips one that isn't, and goes on past a failure", async () => {
    const status = (ahead: number, behind: number, fingerprint: string): JsonValue => GitFixtures.status([], upstream(ahead, behind), { branch: "main", fingerprint }).toJson();
    const context: FakeWindowPartContext = contextOf({ "/work/ahead": status(1, 2, "a1"), "/work/ui": status(0, 2, "u1"), "/work/term": status(0, 3, "t1") },
      { "/work/ui": null, "/work/term": GitFixtures.failure(FailureCode.Git, null, "Not possible to fast-forward.") });
    const errors: ErrorHandler = new ErrorHandler();
    const reported: unknown[] = reportedBy(errors);

    const result: GitBulkResult = await new GitWorkspaceBulk(new GitRuntimeClient(context), errors).pullAsync([target("ahead"), target("ui"), target("term")]);

    expect([result.done, result.skipped.map(t => [t.repository, t.reason]), result.failed.map(t => [t.repository, t.reason])])
      .toEqual([["ui"], [["ahead", "it is no longer only behind its upstream"]], [["term", "Not possible to fast-forward."]]]);
    expect([...callsOf(context, "git.pull")].sort()).toEqual(["/work/term t1", "/work/ui u1"]);
    expect(reported).toEqual([]);
  });

  it("creates the branch in each repository on a status read just before it, skips one that has it, and goes on past failures", async () => {
    const branches = (...names: string[]): JsonValue => new GitBranches("main", ["main", ...names], [], []).toJson();
    const answers: Readonly<Record<string, JsonValue | Error>> = {
      "git.branches /work/ui": branches(), "git.branches /work/git": branches("feature/kit"), "git.branches /work/term": branches(),
      "git.branches /work/odd": new Error("The window went away."), "git.createBranch /work/ui": null,
      "git.createBranch /work/term": GitFixtures.failure(FailureCode.Git, null, "The hook refused it."),
      "git.status /work/ui": GitFixtures.status([], null, { branch: "main", fingerprint: "u1" }).toJson(),
      "git.status /work/term": GitFixtures.status([], null, { branch: "main", fingerprint: "t1" }).toJson()
    };
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("requestAsync", async (method, params) => {
      const answer: JsonValue | Error | undefined = answers[`${method} ${JsonReader.fromValue(params).readString("folder")}`];
      if (answer === undefined || answer instanceof Error)
        throw answer ?? new Error(`No ${method}.`);
      return answer;
    });
    const errors: ErrorHandler = new ErrorHandler();
    const reported: unknown[] = reportedBy(errors);
    const bulk: GitWorkspaceBulk = new GitWorkspaceBulk(new GitRuntimeClient(context), errors);

    const result: GitBulkResult = await bulk.createBranchAsync([target("ui"), target("git"), target("term"), target("odd")], "feature/kit");
    const before: number = context.callsOf("requestAsync").length;
    const refused: GitBulkResult = await bulk.createBranchAsync([target("ui"), target("git")], "a..b");

    expect([result.done, result.skipped.map(t => [t.repository, t.reason]), result.failed.map(t => [t.repository, t.reason])]).toEqual([["ui"],
      [["git", "it already has a branch feature/kit"]], [["term", "The hook refused it."], ["odd", "The window went away."]]]);
    expect([...callsOf(context, "git.createBranch")].sort()).toEqual(["/work/term t1", "/work/ui u1"]);
    expect(reported.map(t => t instanceof Error ? t.message : "")).toEqual(["The window went away."]);
    expect([refused.done, refused.skipped.map(t => [t.repository, t.reason]), refused.failed, context.callsOf("requestAsync").length - before])
      .toEqual([[], [["ui", "Git doesn't take that branch name"], ["git", "Git doesn't take that branch name"]], [], 0]);
  });
});
