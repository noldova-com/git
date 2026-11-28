/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";

import { PermissionDecision, ToolFailure, ToolFailureCode, ToolResult, ToolRisk, type ToolSession } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import type { JsonObject } from "@noldova/git.protocol";

import { RuntimePart } from "../../src/api/index.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { FakeAnswerer } from "../fixtures/fake-answerer.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

interface IToolRefusal {
  readonly code: ToolFailureCode;
  readonly moduleCode: string | null;
}

describe("The Git agent tools", () => {
  const names = ["git_status", "git_diff", "git_log", "git_branches", "git_stage", "git_unstage", "git_create_branch", "git_switch_branch", "git_commit",
    "git_push", "git_pull"];
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let part: RuntimePart;
  let answerer: FakeAnswerer;
  let session: ToolSession;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    supervisor.context.settings.answer("read", () => null);
    part = new RuntimePart();
    await part.activateAsync(supervisor.context);
    cleanUps.add(() => part.deactivateAsync());
    answerer = new FakeAnswerer();
    supervisor.permissions.registerAnswerer("app", answerer, new FakeModuleLog());
    session = supervisor.registry.openSession("chat-1", { "git.folder": repository.folder });
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const isRecord = (value: unknown): value is Record<string, unknown> => Object.isObject(value) && !Array.isArray(value);
  const callAsync = (name: string, input: JsonObject = {}, on: ToolSession = session): Promise<ToolResult | ToolFailure> => on.callAsync(name, input);
  const readAsync = async (name: string, input: JsonObject = {}): Promise<Record<string, unknown>> => {
    const outcome = await callAsync(name, input);
    assert.ok(outcome instanceof ToolResult, outcome instanceof ToolFailure ? `${outcome.code} ${outcome.message}` : name);
    assert.deepEqual(outcome.content.map(t => [t.origin, t.isUntrusted]), [["git:repository", true]]);
    const value: unknown = JSON.parse(outcome.content[0]?.value ?? "");
    assert.ok(isRecord(value));
    return value;
  };
  const failureAsync = async (name: string, input: JsonObject = {}, on: ToolSession = session): Promise<IToolRefusal> => {
    const outcome = await callAsync(name, input, on);
    assert.ok(outcome instanceof ToolFailure, name);
    return { code: outcome.code, moduleCode: outcome.moduleCode };
  };
  const pathsOf = (value: unknown): string[] =>
    (Array.isArray(value) ? value.map((t: unknown) => (Object.isObject(t) && "path" in t ? String(t.path) : "")) : []);
  const subjectAsync = async (): Promise<string> => (await repository.runGitAsync(["log", "-1", "--format=%s"])).trim();
  const hookAsync = async (name: string): Promise<void> => {
    const file = path.join(repository.gitFolder, "hooks", name);
    await writeFile(file, "#!/bin/sh\nexit 0\n");
    await chmod(file, 0o755);
  };

  it("offers the reads read-only at low risk and each write at its risk, taking turns on the bound folder, and withdraws them on deactivation", async () => {
    const offered = session.listTools().map(t => [t.name, t.risk.default, t.risk.maximum, t.hints?.isReadOnly, t.hints?.isOpenWorld, t.resource ?? null,
      t.marksSending === true, t.nextTool ?? null]);
    await part.deactivateAsync();

    const write = (name: string, risk: ToolRisk, isOpenWorld: boolean = false) => [name, risk, risk, false, isOpenWorld, "binding:git.folder", true, "git_status"];
    assert.deepEqual(offered, [
      ...names.slice(0, 4).map(t => [t, ToolRisk.Low, ToolRisk.Low, true, false, null, false, null]),
      write("git_stage", ToolRisk.Low),
      write("git_unstage", ToolRisk.Low),
      write("git_create_branch", ToolRisk.Low),
      write("git_switch_branch", ToolRisk.Medium),
      write("git_commit", ToolRisk.Medium),
      write("git_push", ToolRisk.High, true),
      write("git_pull", ToolRisk.Medium, true)
    ]);
    assert.deepEqual(session.listTools(), []);
  });

  it("reads the bound repository's status, unstaged and staged diff, log and branches as its untrusted text", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    await repository.writeAsync("b.txt", "staged\n");
    await repository.runGitAsync(["add", "b.txt"]);

    const status = await readAsync("git_status");
    assert.deepEqual([status["branch"], pathsOf(status["entries"]).sort()], ["main", ["a.txt", "b.txt"]]);
    assert.deepEqual(pathsOf((await readAsync("git_diff"))["files"]), ["a.txt"]);
    assert.deepEqual(pathsOf((await readAsync("git_diff", { staged: true }))["files"]), ["b.txt"]);
    assert.deepEqual(pathsOf((await readAsync("git_diff", { staged: true, paths: ["a.txt"] }))["files"]), []);
    const log = await readAsync("git_log", { limit: 1 });
    assert.equal(Array.isArray(log["commits"]) ? log["commits"].length : -1, 1);
    assert.equal(Array.isArray((await readAsync("git_log"))["commits"]), true);
    assert.equal((await readAsync("git_branches"))["current"], "main");
  });

  it("refuses a session with no git.folder, a write's before the tool runs, a folder outside any repository, and a path outside the repository", async () => {
    assert.deepEqual(await failureAsync("git_status", {}, supervisor.registry.openSession("chat-2", {})), { code: ToolFailureCode.Refused, moduleCode: "git.noFolder" });
    assert.deepEqual(await failureAsync("git_stage", { paths: ["a.txt"] }, supervisor.registry.openSession("chat-3", {})), { code: ToolFailureCode.Refused, moduleCode: null });
    const outside = supervisor.registry.openSession("chat-4", { "git.folder": repository.root });
    assert.deepEqual(await failureAsync("git_status", {}, outside), { code: ToolFailureCode.Refused, moduleCode: "git.notRepository" });
    assert.deepEqual(await failureAsync("git_diff", { paths: ["../a.txt"] }), { code: ToolFailureCode.Refused, moduleCode: "git.invalidArgument" });
    assert.deepEqual(await failureAsync("git_switch_branch", { name: "--detach" }), { code: ToolFailureCode.Refused, moduleCode: "git.invalidArgument" });
    assert.deepEqual(answerer.requests, []);
  });

  it("tells the agent push asks at high risk, or at medium with an Always allow for a branch the session made", () => {
    const push = session.listTools().find(t => t.name === "git_push");

    assert.match(push?.description ?? "", /at high risk, or at medium risk with an Always allow for this session when the branch is one this session made/v);
    assert.doesNotMatch(push?.description ?? "", /always asks/v);
    assert.match(push?.description ?? "", /to the branch of its own name on its remote, .* it refuses a branch whose upstream has another name\./v);
  });

  it("stages and unstages without asking while no hook would run, and asks at low risk when one would", async () => {
    await repository.writeAsync("c.txt", "new\n");

    assert.deepEqual(pathsOf((await readAsync("git_stage", { paths: ["c.txt"] }))["entries"]), ["c.txt"]);
    assert.equal(await repository.runGitAsync(["status", "--porcelain=v1", "--untracked-files=all"]), "A  c.txt\n");
    await readAsync("git_unstage", { paths: ["c.txt"] });
    assert.equal(await repository.runGitAsync(["status", "--porcelain=v1", "--untracked-files=all"]), "?? c.txt\n");
    assert.equal(answerer.requests.length, 0);

    await hookAsync("post-index-change");
    answerer.answerNext(PermissionDecision.AllowedOnce);
    await readAsync("git_stage", { paths: ["c.txt"] });
    assert.deepEqual(answerer.requests.map(t => [t.action, t.risk]), [["git.stage", ToolRisk.Low]]);
  });

  it("commits, creates a branch and switches back through the person's answers, answering the status after each write", async () => {
    await repository.writeAsync("c.txt", "new\n");
    await readAsync("git_stage", { paths: ["c.txt"] });

    answerer.answerNext(PermissionDecision.AllowedOnce);
    assert.deepEqual((await readAsync("git_commit", { message: "Add c" }))["entries"], []);
    assert.equal(await subjectAsync(), "Add c");
    assert.equal((await readAsync("git_create_branch", { name: "agent" }))["branch"], "agent");
    answerer.answerNext(PermissionDecision.AllowedOnce);
    assert.equal((await readAsync("git_switch_branch", { name: "main" }))["branch"], "main");

    assert.deepEqual(answerer.requests.map(t => [t.action, t.risk]), [["git.commit", ToolRisk.Medium], ["git.switchBranch", ToolRisk.Medium]]);
  });

  it("runs nothing the person denies, and refuses a commit with nothing staged without asking", async () => {
    await repository.writeAsync("c.txt", "new\n");
    await readAsync("git_stage", { paths: ["c.txt"] });
    const subject = await subjectAsync();
    answerer.answerNext(PermissionDecision.Denied);

    assert.deepEqual(await failureAsync("git_commit", { message: "Add c" }), { code: ToolFailureCode.Denied, moduleCode: "git.denied" });
    assert.equal(await subjectAsync(), subject);
    await readAsync("git_unstage", { paths: ["c.txt"] });
    assert.deepEqual(await failureAsync("git_commit", { message: "Nothing" }), { code: ToolFailureCode.Refused, moduleCode: "git.nothingToCommit" });
    assert.equal(answerer.requests.length, 1);
  });

  it("pushes the current branch after a high-risk request", async () => {
    const remote = path.join(repository.root, "remote.git");
    await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
    await repository.runGitAsync(["remote", "add", "origin", remote]);
    await repository.runGitAsync(["fetch", "--quiet", "origin"]);
    await repository.runGitAsync(["branch", "--quiet", "--set-upstream-to=origin/main"]);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Ahead"]);

    answerer.answerNext(PermissionDecision.AllowedOnce);
    await readAsync("git_push");

    assert.equal((await repository.runGitAsync(["-C", remote, "rev-parse", "main"])).trim(), (await repository.runGitAsync(["rev-parse", "HEAD"])).trim());
    assert.deepEqual(answerer.requests.map(t => [t.action, t.risk]), [["git.push", ToolRisk.High]]);
  });

  it("fast-forwards the current branch to its upstream after a medium-risk request", async () => {
    const remote = path.join(repository.root, "remote.git");
    await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
    await repository.runGitAsync(["remote", "add", "origin", remote]);
    await repository.runGitAsync(["fetch", "--quiet", "origin"]);
    await repository.runGitAsync(["branch", "--quiet", "--set-upstream-to=origin/main"]);
    const tree = (await repository.runGitAsync([`--git-dir=${remote}`, "rev-parse", "main^{tree}"])).trim();
    const commit = (await repository.runGitAsync([`--git-dir=${remote}`, "commit-tree", tree, "-p", "main", "-m", "Remote"])).trim();
    await repository.runGitAsync([`--git-dir=${remote}`, "update-ref", "refs/heads/main", commit]);

    answerer.answerNext(PermissionDecision.AllowedOnce);
    await readAsync("git_pull");

    assert.equal((await repository.runGitAsync(["rev-parse", "HEAD"])).trim(), commit);
    assert.deepEqual(answerer.requests.map(t => [t.action, t.risk]), [["git.pull", ToolRisk.Medium]]);
  });

  it("fails a write that git refused after its point of no return as OutcomeUncertain, pointing the agent at git_status", async () => {
    const outcome = await callAsync("git_create_branch", { name: "main" });

    assert.ok(outcome instanceof ToolFailure);
    assert.deepEqual([outcome.code, outcome.moduleCode, outcome.nextTool], [ToolFailureCode.OutcomeUncertain, "git.unavailable", "git_status"]);
    assert.equal(outcome.content[0]?.origin, "git:repository");
  });
});
