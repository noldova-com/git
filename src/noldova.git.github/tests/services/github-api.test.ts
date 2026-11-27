/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { GitHubApi } from "../../src/services/github-api.ts";
import { FakeGitHub } from "../fixtures/fake-github.fixture.ts";

const signal: AbortSignal = new AbortController().signal;
const issue = { number: 1, title: "Found a bug" };
const moved: string = "GitHub answered that this was moved to an address the module doesn't follow. If the repository was renamed or transferred, update the remote to its new address.";

function codeOf(error: unknown): string | null {
  return error instanceof MethodFailureException ? error.failure.code : null;
}

function failureOf(error: unknown): readonly string[] | null {
  return error instanceof MethodFailureException ? [error.failure.code, error.failure.message] : null;
}

function tagged(body: unknown, tag: string): Response {
  return FakeGitHub.json(body, 200, { ETag: tag });
}

describe("GitHubApi", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_800_000_000_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks GitHub's API with the token, and answers a read again from the cache for a minute without asking", async () => {
    const github = new FakeGitHub();
    github.answer(tagged(issue, "\"a\""));
    const api = new GitHubApi(github.fetch);

    const first = await api.getAsync("/repos/octocat/hello-world/issues/1", "gho_token", signal);
    vi.advanceTimersByTime(59_999);
    const again = await api.getAsync("/repos/octocat/hello-world/issues/1", "gho_token", signal);

    assert.deepEqual([first?.toJson(), again?.toJson(), github.urls()], [issue, issue, ["https://api.github.com/repos/octocat/hello-world/issues/1"]]);
    assert.deepEqual([github.requests[0]?.header("Authorization"), github.requests[0]?.header("Accept"), github.requests[0]?.header("If-None-Match")],
      ["Bearer gho_token", "application/vnd.github+json", null]);
  });

  it("asks again after a minute with the answer's tag, reuses the kept answer when nothing changed, and keeps a changed one", async () => {
    const github = new FakeGitHub();
    const changed = { ...issue, title: "Found a bug, again" };
    github.answer(tagged(issue, "\"a\""), new Response(null, { status: 304 }), tagged(changed, "\"b\""));
    const api = new GitHubApi(github.fetch);

    const answers: unknown[] = [];
    for (const wait of [60_000, 60_000, 0, 0]) {
      answers.push((await api.getAsync("/repos/octocat/hello-world/issues/1", "gho_token", signal))?.toJson());
      vi.advanceTimersByTime(wait);
    }

    assert.deepEqual(answers, [issue, issue, changed, changed]);
    assert.deepEqual(github.requests.map(t => t.header("If-None-Match")), [null, "\"a\"", "\"a\""]);
  });

  it("asks without a tag when the kept answer had none, and fails a not-modified answer it has nothing kept for", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json(issue), FakeGitHub.json(issue), new Response(null, { status: 304 }));
    const api = new GitHubApi(github.fetch);

    await api.getAsync("/repos/octocat/hello-world/issues/1", "gho_token", signal);
    vi.advanceTimersByTime(60_000);
    await api.getAsync("/repos/octocat/hello-world/issues/1", "gho_token", signal);
    const unkept = await api.getAsync("/repos/octocat/hello-world/issues/2", "gho_token", signal).then(() => null, codeOf);

    assert.deepEqual([github.requests.map(t => t.header("If-None-Match")), unkept], [[null, null, null], FailureCode.Unavailable]);
  });

  it("keeps each token's answers apart, so one account never sees another's, and each keeps its tags while reads alternate between them", async () => {
    const github = new FakeGitHub();
    github.answer(tagged(issue, "\"a\""), FakeGitHub.json(issue, 404), new Response(null, { status: 304 }), tagged(issue, "\"b\""));
    const api = new GitHubApi(github.fetch);

    await api.getAsync("/repos/octocat/hello-world/issues/1", "gho_token", signal);
    const other = await api.getAsync("/repos/octocat/hello-world/issues/1", "gho_other", signal);
    vi.advanceTimersByTime(61_000);
    const again = await api.getAsync("/repos/octocat/hello-world/issues/1", "gho_token", signal);
    const otherAgain = await api.getAsync("/repos/octocat/hello-world/issues/1", "gho_other", signal);

    assert.deepEqual([other, again?.readString("title"), otherAgain?.readString("title")], [null, "Found a bug", "Found a bug"]);
    assert.deepEqual(github.requests.map(t => [t.header("Authorization"), t.header("If-None-Match")]),
      [["Bearer gho_token", null], ["Bearer gho_other", null], ["Bearer gho_token", "\"a\""], ["Bearer gho_other", null]]);
  });

  it("lets go of the answers of a token no account holds, keeping no answer that lands after, and keeps the others'", async () => {
    const github = new FakeGitHub();
    github.answer(tagged(issue, "\"k\""));
    const release = github.hold();
    github.answer(tagged(issue, "\"c\""));
    const api = new GitHubApi(github.fetch);

    await api.getAsync("/repos/octocat/kept/issues/1", "gho_kept", signal);
    const dropped = api.getAsync("/repos/octocat/private/issues/1", "gho_gone", signal);
    api.keepOnly(t => t === "gho_kept");
    release(tagged({ ...issue, title: "Private" }, "\"p\""));
    await dropped;
    await api.getAsync("/repos/octocat/kept/issues/1", "gho_kept", signal);
    vi.advanceTimersByTime(61_000);
    await api.getAsync("/repos/octocat/private/issues/1", "gho_gone", signal);

    assert.deepEqual(github.requests.map(t => [t.url.slice("https://api.github.com/repos/octocat/".length), t.header("If-None-Match")]), [
      ["kept/issues/1", null], ["private/issues/1", null], ["private/issues/1", null]
    ]);
  });

  it("lets go of the body of each answer it doesn't read: not found, refused, rate limited and failed", async () => {
    const github = new FakeGitHub();
    const unread: readonly Response[] = [FakeGitHub.json({ message: "Not Found" }, 404),
      FakeGitHub.json({ message: "Bad credentials" }, 401), FakeGitHub.json({ message: "Slow down" }, 429), FakeGitHub.json({ message: "Server Error" }, 502),
      FakeGitHub.json({ message: "Not Found" }, 404), FakeGitHub.json({ message: "Validation Failed" }, 422)];
    github.answer(...unread, new Response(null, { status: 404 }));
    const api = new GitHubApi(github.fetch);

    const outcomes: unknown[] = [];
    for (let index = 0; index < 4; index++)
      outcomes.push(await api.getAsync(`/repos/octocat/hello-world/issues/${index + 2}`, "gho_token", signal).then(t => t, (error: unknown) => codeOf(error)));
    for (let index = 0; index < 2; index++)
      outcomes.push(await api.postAsync("/repos/octocat/hello-world/pulls", "gho_token", { title: "Fix" }, signal).then(t => t, (error: unknown) => codeOf(error)));
    outcomes.push(await api.getAsync("/repos/octocat/hello-world/issues/9", "gho_token", signal));

    assert.deepEqual(outcomes, [null, FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.NotFound, FailureCode.Conflict,
      null]);
    assert.deepEqual(unread.map(t => t.bodyUsed), unread.map(() => true));
  });

  it("keeps no answer longer than 256 KiB, and drops what it kept for that address", async () => {
    const github = new FakeGitHub();
    const large = { ...issue, body: "x".repeat(262_144) };
    github.answer(tagged(issue, "\"a\""), tagged(large, "\"b\""), tagged(issue, "\"c\""));
    const api = new GitHubApi(github.fetch);

    await api.getAsync("/items/1", "gho_token", signal);
    vi.advanceTimersByTime(60_000);
    const read = await api.getAsync("/items/1", "gho_token", signal);
    await api.getAsync("/items/1", "gho_token", signal);

    assert.deepEqual([read?.readString("body").length, github.requests.map(t => t.header("If-None-Match"))], [262_144, [null, "\"a\"", null]]);
  });

  it("names when GitHub's rate limit resets, for a 403 with no requests left or a 429, and calls any other 403 a refusal", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({ message: "API rate limit exceeded" }, 403, { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1800003600" }),
      FakeGitHub.json({ message: "Too many requests" }, 429), FakeGitHub.json({ message: "Forbidden" }, 403, { "X-RateLimit-Remaining": "7699" }),
      FakeGitHub.json({ message: "API rate limit exceeded" }, 429, { "X-RateLimit-Reset": "soon" }));
    const api = new GitHubApi(github.fetch);
    const failures: unknown[] = [];

    for (let index = 0; index < 4; index++)
      failures.push(await api.getAsync(`/items/${index}`, "gho_token", signal).then(() => null, (error: unknown) => error instanceof MethodFailureException
        ? [error.failure.code, error.failure.message] : null));

    assert.deepEqual(failures, [
      [FailureCode.Unavailable, "GitHub's rate limit for this account is used up until 2027-01-15T09:00:00.000Z."],
      [FailureCode.Unavailable, "GitHub's rate limit for this account is used up; try again later."],
      [FailureCode.Unavailable, "GitHub refused the request (403)."],
      [FailureCode.Unavailable, "GitHub's rate limit for this account is used up; try again later."]
    ]);
  });

  it("keeps the last 500 answers it read, dropping the one read longest ago", async () => {
    const github = new FakeGitHub();
    for (let index = 0; index <= 501; index++)
      github.answer(tagged({ number: index }, `"${index}"`));
    const api = new GitHubApi(github.fetch);

    for (let index = 0; index < 500; index++)
      await api.getAsync(`/items/${index}`, "gho_token", signal);
    await api.getAsync("/items/0", "gho_token", signal);
    await api.getAsync("/items/500", "gho_token", signal);
    const before: number = github.requests.length;
    await api.getAsync("/items/0", "gho_token", signal);
    await api.getAsync("/items/2", "gho_token", signal);
    await api.getAsync("/items/1", "gho_token", signal);

    assert.deepEqual([before, github.urls().slice(before)], [501, ["https://api.github.com/items/1"]]);
  });

  it("answers a list as its items, and null for what GitHub can't show", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json([issue]), FakeGitHub.json({ message: "Not Found" }, 404));
    const api = new GitHubApi(github.fetch);

    const list = await api.getAsync("/repos/octocat/hello-world/pulls", "gho_token", signal);
    const missing = await api.getAsync("/repos/octocat/hidden/issues/1", "gho_token", signal);

    assert.deepEqual([list?.toJson(), missing], [{ items: [issue] }, null]);
  });

  it("fails as Unauthorized for a token GitHub refuses, Unavailable for a refusal, an unreadable answer or no network, and DeadlineExceeded for a timeout", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401), FakeGitHub.json({ message: "Server Error" }, 502), new Response("<html>"),
      new Response("null"));
    github.fail(new TypeError("fetch failed"));
    github.fail(new DOMException("The operation timed out.", "TimeoutError"));
    const api = new GitHubApi(github.fetch);
    const failures: (string | null)[] = [];
    const messages: string[] = [];

    for (let index = 0; index < 6; index++) {
      const failure: unknown = await api.getAsync(`/items/${index}`, "gho_token", signal).then(() => null, (error: unknown) => error);
      failures.push(codeOf(failure));
      messages.push(failure instanceof MethodFailureException ? failure.failure.message : "");
    }

    assert.deepEqual(failures, [FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable,
      FailureCode.DeadlineExceeded]);
    assert.equal(messages[1], "GitHub refused the request (502).");
  });

  it("passes on a failure that is neither the network's nor the answer's, rather than calling GitHub unreachable or its answer unreadable", async () => {
    const github = new FakeGitHub();
    const unexpected = new RangeError("Unexpected.");
    github.fail(unexpected);
    const api = new GitHubApi(github.fetch);

    const failure: unknown = await api.getAsync("/items/1", "gho_token", signal).then(() => null, (error: unknown) => error);

    assert.equal(failure, unexpected);
    assert.throws(() => GitHubApi.read(() => {
      throw unexpected;
    }), unexpected);
  });

  it("passes on the caller's cancel as it is, not as a network failure", async () => {
    const github = new FakeGitHub();
    const release = github.hold();
    const api = new GitHubApi(github.fetch);
    const waiting = new AbortController();

    const cancelled = api.getAsync("/items/1", "gho_token", waiting.signal).then(() => null, (error: unknown) => error);
    waiting.abort(new Error("Stopped."));
    release(FakeGitHub.json(issue));

    assert.equal(String(await cancelled), "Error: Stopped.");
  });

  it("fails as Unavailable when an answer breaks off while it is read and DeadlineExceeded when it times out, and passes on another failure of the read", async () => {
    const unexpected = new RangeError("Unexpected.");
    const broken = (error: Error): Response => new Response(new ReadableStream<Uint8Array>({ pull: controller => controller.error(error) }));
    const github = new FakeGitHub();
    github.answer(broken(new TypeError("terminated")), broken(new DOMException("The operation timed out.", "TimeoutError")), broken(new TypeError("terminated")),
      broken(unexpected));
    const api = new GitHubApi(github.fetch);

    const terminated: unknown = await api.getAsync("/items/1", "gho_token", signal).then(() => null, (error: unknown) => error);
    const timedOut: unknown = await api.getAsync("/items/2", "gho_token", signal).then(() => null, (error: unknown) => error);
    const posted: unknown = await api.postAsync("/items", "gho_token", { title: "Found a bug" }, signal).then(() => null, (error: unknown) => error);
    const failed: unknown = await api.getAsync("/items/3", "gho_token", signal).then(() => null, (error: unknown) => error);

    assert.deepEqual([codeOf(terminated), codeOf(timedOut), codeOf(posted)], [FailureCode.Unavailable, FailureCode.DeadlineExceeded, FailureCode.Unavailable]);
    assert.equal(terminated instanceof MethodFailureException ? terminated.failure.message : "", "GitHub couldn't be reached.");
    assert.equal(failed, unexpected);
  });

  it("reads an answer of 8 MiB, and fails one past it as Unavailable, letting go of the rest of its body", async () => {
    const limit: number = 8 * 1_024 * 1_024;
    const answerOf = (size: number): Response => new Response(`{"text":"${"x".repeat(size - 11)}"}`);
    const over: Response = answerOf(limit + 1);
    const github = new FakeGitHub();
    github.answer(answerOf(limit), over);
    const api = new GitHubApi(github.fetch);

    const read = await api.getAsync("/items/1", "gho_token", signal);
    const failure: unknown = await api.getAsync("/items/2", "gho_token", signal).then(() => null, (error: unknown) => error);

    assert.deepEqual([read?.readString("text").length, codeOf(failure), failure instanceof MethodFailureException ? failure.failure.message : null, over.bodyUsed],
      [limit - 11, FailureCode.Unavailable, "GitHub's answer is over 8 MiB, more than the module reads.", true]);
  });

  it("ends with the caller's reason when the caller stops it and the answer's read breaks off", async () => {
    const reading = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      pull: controller => {
        reading.abort(new Error("Stopped while reading."));
        controller.error(new TypeError("terminated"));
      }
    }, { highWaterMark: 0 });
    const api = new GitHubApi(() => Promise.resolve(new Response(body)));

    const stopped: unknown = await api.getAsync("/items/1", "gho_token", reading.signal).then(() => null, (error: unknown) => error);

    assert.deepEqual(stopped, new Error("Stopped while reading."));
  });

  it("posts JSON with the token, answers GitHub's reply, and fails a missing repository as NotFound and a refused one as Conflict", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json(issue, 201), FakeGitHub.json({ message: "Not Found" }, 404), FakeGitHub.json({ message: "Validation Failed" }, 422));
    const api = new GitHubApi(github.fetch);
    const body = { title: "Add a feature", head: "feature", base: "main", draft: false };

    const created = await api.postAsync("/repos/octocat/hello-world/pulls", "gho_token", body, signal);
    const failures = [await api.postAsync("/repos/octocat/hidden/pulls", "gho_token", body, signal).then(() => null, codeOf),
      await api.postAsync("/repos/octocat/hello-world/pulls", "gho_token", body, signal).then(() => null, codeOf)];

    assert.deepEqual([created.toJson(), failures], [issue, [FailureCode.NotFound, FailureCode.Conflict]]);
    assert.deepEqual([github.requests[0]?.init.method, github.requests[0]?.body, github.requests[0]?.header("Content-Type"), github.requests[0]?.header("Authorization")],
      ["POST", body, "application/json", "Bearer gho_token"]);
  });

  it("follows GitHub's 301 for a renamed repository by hand when it stays on GitHub's API over HTTPS, with the token, and reads the answer", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({}, 301, { Location: "https://api.github.com/repositories/1296269" }), FakeGitHub.json(issue),
      FakeGitHub.json({}, 301, { Location: "/repositories/1296269/pulls?state=open" }), FakeGitHub.json([]));
    const api = new GitHubApi(github.fetch);

    const reads = [await api.getAsync("/repos/octocat/hello-world", "gho_token", signal), await api.getAsync("/repos/octocat/hello-world/pulls", "gho_token", signal)];

    assert.deepEqual([reads.map(t => t?.toJson()), github.urls(), github.requests.map(t => [t.init.redirect, t.header("Authorization")])], [[issue, { items: [] }],
      ["https://api.github.com/repos/octocat/hello-world", "https://api.github.com/repositories/1296269", "https://api.github.com/repos/octocat/hello-world/pulls",
        "https://api.github.com/repositories/1296269/pulls?state=open"], [0, 1, 2, 3].map(() => ["manual", "Bearer gho_token"])]);
  });

  it("refuses a read's redirect to another host, to plain HTTP, with credentials or without a target, so the token stays on GitHub's API, and says the repository moved", async () => {
    const targets = [{ Location: "https://api.fabrikam.test/repos/octocat/hello-world" }, { Location: "http://api.github.com/repositories/1296269" },
      { Location: "https://monalisa@api.github.com/repositories/1296269" },
      { Location: "https://:x@api.github.com/repositories/1296269" }, {}];
    const github = new FakeGitHub();
    github.answer(...targets.map(t => FakeGitHub.json({}, 301, t)));
    const api = new GitHubApi(github.fetch);

    const failures: (readonly string[] | null)[] = [];
    for (const name of ["one", "two", "three", "four", "five"])
      failures.push(await api.getAsync(`/repos/octocat/${name}`, "gho_token", signal).then(() => null, failureOf));

    assert.deepEqual([failures, github.urls()], [targets.map(() => [FailureCode.Unavailable, moved]),
      ["one", "two", "three", "four", "five"].map(t => `https://api.github.com/repos/octocat/${t}`)]);
  });

  it("follows only one redirect, refusing a second one on GitHub's API and saying the repository moved", async () => {
    const github = new FakeGitHub();
    github.answer(...[1, 2].map(t => FakeGitHub.json({}, 301, { Location: `https://api.github.com/repositories/${t}` })), FakeGitHub.json(issue));
    const api = new GitHubApi(github.fetch);

    const failure = await api.getAsync("/repos/octocat/hello-world", "gho_token", signal).then(() => null, failureOf);

    assert.deepEqual([failure, github.urls()], [[FailureCode.Unavailable, moved], ["https://api.github.com/repos/octocat/hello-world",
      "https://api.github.com/repositories/1"]]);
  });

  it("follows no post's redirect, even on GitHub's API, so the body goes nowhere else, and says the repository moved", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({}, 307, { Location: "https://api.github.com/repositories/1296269/pulls" }),
      FakeGitHub.json({}, 308, { Location: "https://api.fabrikam.test/repos/octocat/hello-world/pulls" }));
    const api = new GitHubApi(github.fetch);

    const failures: (readonly string[] | null)[] = [];
    for (let i = 0; i < 2; i++)
      failures.push(await api.postAsync("/repos/octocat/hello-world/pulls", "gho_token", { title: "Add a feature" }, signal).then(() => null, failureOf));

    assert.deepEqual([failures, github.urls(), github.requests.map(t => t.init.redirect)], [[[FailureCode.Unavailable, moved],
      [FailureCode.Unavailable, moved]], ["https://api.github.com/repos/octocat/hello-world/pulls", "https://api.github.com/repos/octocat/hello-world/pulls"],
      ["manual", "manual"]]);
  });
});
