/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { PermissionDecision, PermissionDetailKind, PermissionOption, ToolFailure, ToolFailureCode, ToolResult, ToolRisk } from "@noldova/desktop.runtime";
import { afterEach, describe, it, vi } from "vitest";

import { SignedInAccount } from "../../src/models/signed-in-account.ts";
import { FakeGitHub } from "../fixtures/fake-github.fixture.ts";
import { statusOf } from "../fixtures/fake-tools.fixture.ts";
import { draft, failTitle, failureOf, forkRig, PrToolsRig, pull, textOf } from "../fixtures/pr-tools.fixture.ts";

describe("GitHubPrCreateTool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes on a failure to read the arguments that isn't the draft's refusal, rather than refusing the call", async () => {
    const rig = new PrToolsRig();
    failTitle(new RangeError("Unexpected."));

    const outcome = await rig.createAsync();

    assert.deepEqual([failureOf(outcome), rig.answerer.requests.length, rig.github.requests.length], [[ToolFailureCode.Unavailable, "git-github.internal"], 0, 0]);
  });

  it("is a high-risk write that reaches GitHub, marks its point of no return, takes turns per bound folder and points to the checks", () => {
    const tool = new PrToolsRig().session.listTools().find(t => t.name === "git_github_pr_create");

    assert.deepEqual([tool?.hints, tool?.risk, tool?.marksSending, tool?.isResumable, tool?.resource, tool?.nextTool, tool?.deadline],
      [{ isReadOnly: false, isDestructive: false, isOpenWorld: true }, { default: ToolRisk.High, maximum: ToolRisk.High }, true, false,
        "binding:git.folder", "git_github_pr_checks", { default: 60_000, maximum: 120_000 }]);
  });

  it("asks the person every time, with the pull request's exact fields and no Always allow, then opens it from the session's branch and answers it as untrusted text", async () => {
    const rig = new PrToolsRig();
    rig.answerer.answerNext(PermissionDecision.AllowedOnce);
    rig.github.answer(FakeGitHub.json({ ...pull, draft: true }, 201));

    const answer = textOf(await rig.createAsync());

    assert.deepEqual([answer.readString("title"), answer.readString("state"), answer.readString("url")], ["Fix the bug", "Draft", pull.html_url]);
    assert.deepEqual(rig.answerer.requests, [{
      action: "git-github.createPullRequest",
      subject: "github.com/octocat/hello-world",
      title: "Open a draft pull request in octocat/hello-world",
      details: [
        { label: "GitHub account", kind: PermissionDetailKind.Text, value: "octocat" },
        { label: "Branch", kind: PermissionDetailKind.Code, value: "fix-bug → main" },
        { label: "Title", kind: PermissionDetailKind.AgentText, value: "Fix the bug" },
        { label: "Draft", kind: PermissionDetailKind.Text, value: "yes" },
        { label: "Body", kind: PermissionDetailKind.AgentText, value: "\nFixes #1." }
      ],
      risk: ToolRisk.High,
      isAsking: undefined,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny],
      labels: undefined,
      isRememberedOnly: undefined
    }]);
    assert.deepEqual([rig.github.urls(), rig.github.requests[0]?.body], [["https://api.github.com/repos/octocat/hello-world/pulls"],
      { title: "Fix the bug", body: "Fixes #1.", head: "fix-bug", base: "main", draft: true }]);
  });

  it("opens the pull request on origin when the branch tracks upstream or tracks no remote of two", async () => {
    const rigs = [forkRig(true), forkRig(false)];
    for (const rig of rigs) {
      rig.answerer.answerNext(PermissionDecision.AllowedOnce);
      rig.github.answer(FakeGitHub.json(pull, 201));
    }

    const outcomes = await Promise.all(rigs.map(t => t.createAsync()));

    assert.deepEqual(outcomes.map(t => t instanceof ToolResult), [true, true]);
    assert.deepEqual(rigs.map(t => [t.answerer.requests[0]?.subject, t.github.urls(), t.github.requests[0]?.body]), [true, false].map(() => [
      "github.com/monalisa/hello-world", ["https://api.github.com/repos/monalisa/hello-world/pulls"],
      { title: "Fix the bug", body: "Fixes #1.", head: "fix-bug", base: "main", draft: true }]));
  });

  it("opens a ready pull request with no description when the agent gives neither", async () => {
    const rig = new PrToolsRig();
    rig.repositories.answer = statusOf("fix-bug", "github.com", "octocat/hello-world");
    rig.answerer.answerNext(PermissionDecision.AllowedOnce);
    rig.github.answer(FakeGitHub.json(pull, 201));

    const outcome = await rig.createAsync({ title: "Fix the bug", base: "main" });

    assert.ok(outcome instanceof ToolResult);
    const request = rig.answerer.requests[0];
    assert.deepEqual([request?.title, request?.details.map(t => [t.label, t.value]), rig.github.requests[0]?.body],
      ["Open a pull request in octocat/hello-world", [["GitHub account", "octocat"], ["Branch", "fix-bug → main"], ["Title", "Fix the bug"], ["Draft", "no"]],
        { title: "Fix the bug", body: "", head: "fix-bug", base: "main", draft: false }]);
  });

  it("shows the whole body under its label, without trailing blank lines, and leaves out a blank one, opening each body as given", async () => {
    const bodies = ["One\nTwo\nThree\n", "\r\nOne\r\nTwo\r\n\r\n", "  \n\t\n"];
    const rigs = bodies.map(() => new PrToolsRig());
    for (const rig of rigs) {
      rig.answerer.answerNext(PermissionDecision.AllowedOnce);
      rig.github.answer(FakeGitHub.json(pull, 201));
    }

    await Promise.all(rigs.map((t, i) => t.createAsync({ ...draft, body: bodies[i] ?? "" })));

    assert.deepEqual(rigs.map(t => t.answerer.requests[0]?.details.slice(4).map(u => [u.label, u.value])),
      [[["Body", "\nOne\nTwo\nThree"]], [["Body", "\n\r\nOne\r\nTwo"]], []]);
    assert.deepEqual(rigs.map(t => t.github.requests[0]?.body),
      bodies.map(t => ({ title: "Fix the bug", body: t, head: "fix-bug", base: "main", draft: true })));
  });

  it("refuses a title with any line break Desktop counts, a vertical tab, form feed and next line included, before asking the person or GitHub", async () => {
    const titles = ["Fix\nDraft: no", "Fix\rDraft: no", "Fix\vDraft: no", "Fix\fDraft: no", "Fix\u0085Draft: no", "Fix\u2028Draft: no", "Fix\u2029Draft: no"];
    const rigs = titles.map(() => new PrToolsRig());

    const outcomes = await Promise.all(rigs.map((t, i) => t.createAsync({ ...draft, title: titles[i] ?? "" })));

    assert.deepEqual(outcomes.map(t => failureOf(t)?.[0]), titles.map(() => ToolFailureCode.Refused));
    assert.deepEqual(rigs.map(t => [t.answerer.requests.length, t.github.requests.length]), titles.map(() => [0, 0]));
  });

  it("refuses a 30,000-character Japanese body, whose details would pass Desktop's 80 KiB, before asking the person or GitHub, as Desktop's 64 KiB of arguments ends the call", async () => {
    const rig = new PrToolsRig();
    rig.answerer.answerNext(PermissionDecision.AllowedOnce);
    rig.github.answer(FakeGitHub.json(pull, 201));
    const body: string = "あ".repeat(30_000);

    const outcome = await rig.createAsync({ ...draft, body });

    assert.deepEqual([Buffer.byteLength(body) > 80 * 1_024, failureOf(outcome), rig.answerer.requests.length, rig.github.requests.length],
      [true, [ToolFailureCode.Refused, null], 0, 0]);
  });

  it("opens nothing when the person doesn't allow it, failing with the decision", async () => {
    const outcomes: (ReturnType<typeof failureOf> | number)[] = [];
    for (const decision of [PermissionDecision.Denied, PermissionDecision.DeniedAlways, PermissionDecision.Expired]) {
      const rig = new PrToolsRig();
      rig.answerer.answerNext(decision);
      outcomes.push(failureOf(await rig.createAsync()), rig.github.requests.length);
    }

    assert.deepEqual(outcomes, [[ToolFailureCode.Denied, null], 0, [ToolFailureCode.Denied, null], 0, [ToolFailureCode.Expired, null], 0]);
  });

  it("opens nothing when the call is aborted while the person is asked, failing as Withdrawn", async () => {
    const rig = new PrToolsRig();
    const asked = rig.answerer.hold();
    const cancel = new AbortController();

    const pending = rig.createAsync(draft, cancel.signal);
    await asked;
    cancel.abort();

    assert.deepEqual([failureOf(await pending), rig.github.requests.length], [[ToolFailureCode.Withdrawn, null], 0]);
  });

  it("chooses the repository's account before asking, names it in the request, and opens the pull request with that account's token", async () => {
    const rig = new PrToolsRig();
    rig.token.choose("github.com", "octocat/hello-world", new SignedInAccount(2, "hubot", "gho_hubot"));
    rig.answerer.answerNext(PermissionDecision.AllowedOnce);
    rig.github.answer(FakeGitHub.json(pull, 201));

    const outcome = await rig.createAsync();

    assert.ok(outcome instanceof ToolResult);
    assert.deepEqual([rig.answerer.requests[0]?.details[0], rig.token.asked, rig.github.requests.map(t => t.header("Authorization"))],
      [{ label: "GitHub account", kind: PermissionDetailKind.Text, value: "hubot" }, ["github.com octocat/hello-world"], ["Bearer gho_hubot"]]);
  });

  it("opens nothing, failing as signed out, when the account the request named signs out while the person is asked", async () => {
    const rig = new PrToolsRig();
    rig.token.choose("github.com", "octocat/hello-world", new SignedInAccount(2, "hubot", "gho_hubot"));
    rig.answerer.answer("answerAsync", () => {
      rig.token.signOut("gho_hubot");
      return Promise.resolve(PermissionDecision.AllowedOnce);
    });

    const outcome = await rig.createAsync();

    assert.deepEqual([failureOf(outcome), rig.github.requests.length], [[ToolFailureCode.Unavailable, "git-github.signedOut"], 0]);
  });

  it("refuses a base that is the session's own branch and fails as signed out when signed out, without asking the person", async () => {
    const same = new PrToolsRig();
    const signedOut = new PrToolsRig(null);

    const outcomes = [await same.createAsync({ ...draft, base: "fix-bug" }), await signedOut.createAsync()];

    assert.deepEqual([outcomes.map(failureOf), same.answerer.requests.length + signedOut.answerer.requests.length],
      [[[ToolFailureCode.Refused, null], [ToolFailureCode.Unavailable, "git-github.signedOut"]], 0]);
  });

  it("ends as OutcomeUncertain, pointing to the checks, when GitHub refuses or fails after the person allowed it", async () => {
    const refused = new PrToolsRig();
    refused.answerer.answerNext(PermissionDecision.AllowedOnce);
    refused.github.answer(FakeGitHub.json({ message: "A pull request already exists for octocat:fix-bug." }, 422));
    const revoked = new PrToolsRig();
    revoked.answerer.answerNext(PermissionDecision.AllowedOnce);
    revoked.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401));

    const outcomes = [await refused.createAsync(), await revoked.createAsync()];

    assert.deepEqual(outcomes.map(t => t instanceof ToolFailure ? [t.code, t.moduleCode, t.nextTool] : null), [
      [ToolFailureCode.OutcomeUncertain, "git-github.refused", "git_github_pr_checks"],
      [ToolFailureCode.OutcomeUncertain, "git-github.signedOut", "git_github_pr_checks"]]);
  });
});
