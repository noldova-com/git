/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonException, JsonReader } from "@noldova/context.json";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { HostAccount, HostingArgumentException } from "@noldova/git.hosting.protocol";
import { afterEach, describe, it, vi } from "vitest";

import { GitHubException } from "../../src/exceptions/github.exception.ts";
import { SignInAnswerTooLargeException } from "../../src/exceptions/sign-in-answer-too-large.exception.ts";
import { SignInErrorException } from "../../src/exceptions/sign-in-error.exception.ts";
import { SignInExpiryInvalidException } from "../../src/exceptions/sign-in-expiry-invalid.exception.ts";
import { SignInRequestRefusedException } from "../../src/exceptions/sign-in-request-refused.exception.ts";
import { SignInUnreachableException } from "../../src/exceptions/sign-in-unreachable.exception.ts";
import { AccountRead } from "../../src/models/account-read.ts";
import type { DevicePoll } from "../../src/models/device-poll.ts";
import { GitHubAvatars } from "../../src/services/github-avatars.ts";
import { GitHubDeviceFlow } from "../../src/services/github-device-flow.ts";
import { FakeGitHub } from "../fixtures/fake-github.fixture.ts";

const grant = { device_code: "3584d83530557fdd1f46af8289938c8ef79f9dc5", user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 };
const user = { login: "octocat", name: "The Octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231" };

const png: Uint8Array<ArrayBuffer> = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const avatar: string = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;

function unread(): GitHubAvatars {
  return new GitHubAvatars(new FakeGitHub().fetch, new FakeModuleLog());
}

function failureOf(error: unknown): string | null {
  return error instanceof GitHubException ? error.name : null;
}

function causeOf(error: unknown): unknown {
  return error instanceof GitHubException ? error.cause : null;
}

describe("GitHubDeviceFlow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks GitHub for a code under Noldova's app, for the repo scope, and reads its expiry and interval in milliseconds", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json(grant));

    const read = await new GitHubDeviceFlow(github.fetch, unread()).requestCodeAsync(1_000, new AbortController().signal);

    assert.deepEqual([github.urls(), github.requests[0]?.init.method, github.requests[0]?.body], [
      ["https://github.com/login/device/code"], "POST", { client_id: "Ov23liRKBcNQMxG9PGar", scope: "repo" }]);
    assert.deepEqual([github.requests[0]?.header("Accept"), github.requests[0]?.header("Content-Type")], ["application/json", "application/json"]);
    assert.deepEqual([read.deviceCode, read.code.userCode, read.code.verificationUri, read.code.expiresAt, read.expiresIn, read.interval],
      [grant.device_code, "WDJB-MJHT", "https://github.com/login/device", 901_000, 900_000, 5_000]);
  });

  it("refuses a code GitHub answers with an error status, with a body that isn't JSON or with a field out of its range", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({ error: "unauthorized_client" }, 400), new Response("<html>"), FakeGitHub.json({ ...grant, expires_in: 0 }),
      FakeGitHub.json({ ...grant, expires_in: 3_601 }), FakeGitHub.json({ ...grant, verification_uri: "http://github.com/login/device" }));
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const errors: unknown[] = [];

    for (let index = 0; index < 5; index++)
      errors.push(await flow.requestCodeAsync(1_000, new AbortController().signal).then(() => null, (error: unknown) => error));

    assert.deepEqual(errors.map(failureOf), ["SignInRequestRefusedException", "SignInAnswerUnreadableException", "SignInExpiryInvalidException",
      "SignInExpiryInvalidException", "SignInAnswerUnreadableException"]);
    assert.deepEqual(errors[0] instanceof SignInRequestRefusedException ? [errors[0].url, errors[0].status] : null, ["https://github.com/login/device/code", 400]);
    assert.deepEqual([errors[2], errors[3]].map(t => t instanceof SignInExpiryInvalidException ? t.seconds : null), [0, 3_601]);
    assert.ok(causeOf(errors[1]) instanceof JsonException);
    assert.ok(causeOf(errors[4]) instanceof HostingArgumentException);
  });

  it("passes on a failure that isn't the answer's, rather than calling the answer unreadable", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json(grant));
    const unexpected = new RangeError("Unexpected.");
    vi.spyOn(JsonReader, "parse").mockImplementation(() => {
      throw unexpected;
    });

    const error: unknown = await new GitHubDeviceFlow(github.fetch, unread()).requestCodeAsync(1_000, new AbortController().signal).then(() => null, (t: unknown) => t);

    assert.equal(error, unexpected);
  });

  it("reads a sign-in answer of 64 KiB, and refuses one past it, naming the address, without reading the rest", async () => {
    const padded = (value: unknown, size: number): Response => {
      const text: string = JSON.stringify(value);
      return new Response(text + " ".repeat(size - Buffer.byteLength(text)));
    };
    const github = new FakeGitHub();
    github.answer(padded(grant, 65_536), padded({ error: "authorization_pending" }, 65_537));
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const signal = new AbortController().signal;

    const read = await flow.requestCodeAsync(1_000, signal);
    const failure: unknown = await flow.pollAsync(grant.device_code, signal).then(() => null, (error: unknown) => error);

    assert.deepEqual([read.deviceCode, failureOf(failure), failure instanceof SignInAnswerTooLargeException ? failure.url : null],
      [grant.device_code, "SignInAnswerTooLargeException", "https://github.com/login/oauth/access_token"]);
  });

  it("takes five seconds when GitHub names no interval, and at least a second for an interval or a slow-down", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({ ...grant, interval: undefined, expires_in: 3_600 }), FakeGitHub.json({ ...grant, interval: 0 }),
      FakeGitHub.json({ error: "slow_down", interval: -3 }));
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const signal = new AbortController().signal;

    const missing = await flow.requestCodeAsync(1_000, signal);
    const zero = await flow.requestCodeAsync(1_000, signal);
    const slowed = await flow.pollAsync(grant.device_code, signal);

    assert.deepEqual([missing.interval, missing.code.expiresAt, zero.interval, slowed.interval], [5_000, 3_601_000, 1_000, 1_000]);
  });

  it("takes at most an hour for an interval or a slow-down, so a longer one can't outlast every code", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({ ...grant, interval: 3_601 }), FakeGitHub.json({ error: "slow_down", interval: 10_000_000 }));
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const signal = new AbortController().signal;

    const long = await flow.requestCodeAsync(1_000, signal);
    const slowed = await flow.pollAsync(grant.device_code, signal);

    assert.deepEqual([long.interval, slowed.interval], [3_600_000, 3_600_000]);
  });

  it("names GitHub unreachable when a request fails, and ends with the caller's own reason when the caller stops it", async () => {
    const github = new FakeGitHub();
    github.fail(new TypeError("fetch failed"));
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const stop = new AbortController();
    const release = github.hold();

    const unreachable: unknown = await flow.requestCodeAsync(1_000, new AbortController().signal).then(() => null, (error: unknown) => error);
    const stopped = flow.pollAsync("code", stop.signal).then(() => null, (error: unknown) => error);
    stop.abort(new Error("Stopped."));
    release(FakeGitHub.json({ error: "authorization_pending" }));

    assert.ok(unreachable instanceof SignInUnreachableException);
    assert.deepEqual([unreachable.url, String(unreachable.cause)], ["https://github.com/login/device/code", "TypeError: fetch failed"]);
    assert.deepEqual(await stopped, new Error("Stopped."));
  });

  it("ends with the caller's reason when the caller stops it after GitHub answered, while the answer is read", async () => {
    const stop = new AbortController();
    const reading = new AbortController();
    const atAnswer = new GitHubDeviceFlow(() => {
      stop.abort(new Error("Stopped."));
      return Promise.resolve(FakeGitHub.json({ error: "authorization_pending" }));
    }, unread());
    const body = new ReadableStream<Uint8Array>({
      pull: controller => {
        reading.abort(new Error("Stopped while reading."));
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ error: "authorization_pending" })));
        controller.close();
      }
    });
    const atBody = new GitHubDeviceFlow(() => Promise.resolve(new Response(body)), unread());

    const stopped = [await atAnswer.pollAsync("code", stop.signal).then(() => null, (error: unknown) => error),
      await atBody.pollAsync("code", reading.signal).then(() => null, (error: unknown) => error)];

    assert.deepEqual(stopped, [new Error("Stopped."), new Error("Stopped while reading.")]);
  });

  it("names GitHub unreachable when a request times out, and passes on a failure of the request that isn't the network's", async () => {
    const github = new FakeGitHub();
    const unexpected = new RangeError("Unexpected.");
    github.fail(new DOMException("The operation timed out.", "TimeoutError"));
    github.fail(unexpected);
    const flow = new GitHubDeviceFlow(github.fetch, unread());

    const timedOut: unknown = await flow.requestCodeAsync(1_000, new AbortController().signal).then(() => null, (error: unknown) => error);
    const failed: unknown = await flow.pollAsync("code", new AbortController().signal).then(() => null, (error: unknown) => error);

    assert.ok(timedOut instanceof SignInUnreachableException);
    assert.deepEqual([timedOut.url, String(timedOut.cause)], ["https://github.com/login/device/code", "TimeoutError: The operation timed out."]);
    assert.equal(failed, unexpected);
  });

  it("names GitHub unreachable when its answer breaks off or times out while it is read, and passes on another failure of the read", async () => {
    const unexpected = new RangeError("Unexpected.");
    const broken = (error: Error): Response => new Response(new ReadableStream<Uint8Array>({ pull: controller => controller.error(error) }));
    const github = new FakeGitHub();
    github.answer(broken(new TypeError("terminated")), broken(new DOMException("The operation timed out.", "TimeoutError")), broken(unexpected));
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const signal = new AbortController().signal;

    const terminated: unknown = await flow.requestCodeAsync(1_000, signal).then(() => null, (error: unknown) => error);
    const timedOut: unknown = await flow.pollAsync("code", signal).then(() => null, (error: unknown) => error);
    const failed: unknown = await flow.readAccountAsync("gho_token", signal).then(() => null, (error: unknown) => error);

    assert.ok(terminated instanceof SignInUnreachableException);
    assert.ok(timedOut instanceof SignInUnreachableException);
    assert.deepEqual([terminated.url, String(terminated.cause), timedOut.url, String(timedOut.cause)], ["https://github.com/login/device/code",
      "TypeError: terminated", "https://github.com/login/oauth/access_token", "TimeoutError: The operation timed out."]);
    assert.equal(failed, unexpected);
  });

  it("ends with the caller's reason when the caller stops it and the answer's read breaks off", async () => {
    const reading = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      pull: controller => {
        reading.abort(new Error("Stopped while reading."));
        controller.error(new TypeError("terminated"));
      }
    });
    const flow = new GitHubDeviceFlow(() => Promise.resolve(new Response(body)), unread());

    const stopped: unknown = await flow.pollAsync("code", reading.signal).then(() => null, (error: unknown) => error);

    assert.deepEqual(stopped, new Error("Stopped while reading."));
  });

  it("polls with the device code, and reads a pending answer, a slow-down with and without an interval and a token", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({ error: "authorization_pending" }), FakeGitHub.json({ error: "slow_down", interval: 10 }), FakeGitHub.json({ error: "slow_down" }),
      FakeGitHub.json({ access_token: "gho_token", token_type: "bearer", scope: "repo" }));
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const polls: DevicePoll[] = [];

    for (let index = 0; index < 4; index++)
      polls.push(await flow.pollAsync(grant.device_code, new AbortController().signal));

    assert.deepEqual(github.requests[0]?.body, { client_id: "Ov23liRKBcNQMxG9PGar", device_code: grant.device_code, grant_type: "urn:ietf:params:oauth:grant-type:device_code" });
    assert.deepEqual(github.urls()[0], "https://github.com/login/oauth/access_token");
    assert.deepEqual(polls.map(t => [t.token, t.slowDown, t.interval]), [[null, false, null], [null, true, 10_000], [null, true, null], ["gho_token", false, null]]);
  });

  it("ends a poll that GitHub answers with an expired code, a denial or an error it doesn't name", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({ error: "expired_token" }), FakeGitHub.json({ error: "access_denied" }), FakeGitHub.json({ error: "incorrect_client_credentials" }),
      FakeGitHub.json({ access_token: "" }));
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const errors: unknown[] = [];

    for (let index = 0; index < 4; index++)
      errors.push(await flow.pollAsync(grant.device_code, new AbortController().signal).then(() => null, (error: unknown) => error));

    assert.deepEqual(errors.map(failureOf), ["SignInExpiredException", "SignInDeniedException", "SignInErrorException", "SignInAnswerUnreadableException"]);
    assert.equal(errors[2] instanceof SignInErrorException ? errors[2].error : null, "incorrect_client_credentials");
    assert.ok(causeOf(errors[3]) instanceof JsonException);
  });

  it("reads the token's account with its scopes and its avatar's address, and answers null for a token GitHub no longer accepts", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json(user, 200, { "X-OAuth-Scopes": "repo, read:org" }), FakeGitHub.json({ ...user, name: null, avatar_url: null }),
      FakeGitHub.json({ message: "Bad credentials" }, 401));
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const signal = new AbortController().signal;

    const reads = [await flow.readAccountAsync("gho_token", signal), await flow.readAccountAsync("gho_token", signal), await flow.readAccountAsync("gho_old", signal)];

    assert.deepEqual(reads, [new AccountRead(new HostAccount("octocat", "The Octocat", null, ["repo", "read:org"]), user.avatar_url),
      new AccountRead(new HostAccount("octocat", null, null, []), null), null]);
    assert.deepEqual([github.urls()[0], github.requests[0]?.header("Authorization"), github.requests[0]?.header("Accept"), github.requests[0]?.header("X-GitHub-Api-Version")],
      ["https://api.github.com/user", "Bearer gho_token", "application/vnd.github+json", "2022-11-28"]);
  });

  it("adds the account's avatar as data, read without the token, and leaves the account as it was when there is none or it can't be read", async () => {
    const pictures = new FakeGitHub();
    pictures.answer(new Response(new Blob([png]), { status: 200, headers: { "Content-Type": "image/png" } }), FakeGitHub.json({}, 404));
    const flow = new GitHubDeviceFlow(new FakeGitHub().fetch, new GitHubAvatars(pictures.fetch, new FakeModuleLog()));
    const account = new HostAccount("octocat", "The Octocat", null, ["repo"]);
    const signal = new AbortController().signal;

    const shown = [await flow.withAvatarAsync(new AccountRead(account, user.avatar_url), signal), await flow.withAvatarAsync(new AccountRead(account, null), signal),
      await flow.withAvatarAsync(new AccountRead(account, "https://avatars.githubusercontent.com/u/2"), signal)];

    assert.deepEqual(shown, [new HostAccount("octocat", "The Octocat", avatar, ["repo"]), account, account]);
    assert.deepEqual([shown[1] === account, shown[2] === account], [true, true]);
    assert.deepEqual([pictures.urls(), pictures.requests.map(t => t.header("Authorization"))],
      [["https://avatars.githubusercontent.com/u/583231?s=64", "https://avatars.githubusercontent.com/u/2?s=64"], [null, null]]);
  });

  it("ends an avatar read stopped by the caller with the caller's reason", async () => {
    const pictures = new FakeGitHub();
    pictures.hold();
    const flow = new GitHubDeviceFlow(new FakeGitHub().fetch, new GitHubAvatars(pictures.fetch, new FakeModuleLog()));
    const stop = new AbortController();

    const stopping = flow.withAvatarAsync(new AccountRead(new HostAccount("octocat", null, null, []), user.avatar_url), stop.signal).then(() => null, (error: unknown) => error);
    await pictures.askedAsync(1);
    stop.abort(new Error("Stopped."));

    assert.deepEqual(await stopping, new Error("Stopped."));
  });

  it("refuses an account GitHub answers with another error status or without a login", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({ message: "Server Error" }, 500), FakeGitHub.json({ ...user, login: "" }));
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const signal = new AbortController().signal;

    const errors: unknown[] = [await flow.readAccountAsync("gho_token", signal).then(() => null, (error: unknown) => error),
      await flow.readAccountAsync("gho_token", signal).then(() => null, (error: unknown) => error)];

    assert.deepEqual(errors.map(failureOf), ["SignInRequestRefusedException", "SignInAnswerUnreadableException"]);
    assert.deepEqual(errors[0] instanceof SignInRequestRefusedException ? [errors[0].url, errors[0].status] : null, ["https://api.github.com/user", 500]);
  });

  it("lets go of the body of each answer it doesn't read: a refused code, a refused account and a token GitHub no longer accepts", async () => {
    const github = new FakeGitHub();
    const unreadAnswers: readonly Response[] = [FakeGitHub.json({ message: "Server Error" }, 502), FakeGitHub.json({ message: "Server Error" }, 500),
      FakeGitHub.json({ message: "Bad credentials" }, 401)];
    github.answer(...unreadAnswers);
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const signal = new AbortController().signal;

    const outcomes: unknown[] = [await flow.requestCodeAsync(Date.now(), signal).then(() => null, failureOf),
      await flow.readAccountAsync("gho_token", signal).then(() => null, failureOf), await flow.readAccountAsync("gho_old", signal)];

    assert.deepEqual(outcomes, ["SignInRequestRefusedException", "SignInRequestRefusedException", null]);
    assert.deepEqual(unreadAnswers.map(t => t.bodyUsed), [true, true, true]);
  });

  it("follows no redirect, so the device code and the token stay with GitHub, refusing a code, a poll or an account GitHub redirects", async () => {
    const github = new FakeGitHub();
    const away = { Location: "https://login.fabrikam.com/oauth" };
    github.answer(FakeGitHub.json({}, 307, away), FakeGitHub.json({}, 308, away), FakeGitHub.json({}, 302, away));
    const flow = new GitHubDeviceFlow(github.fetch, unread());
    const signal = new AbortController().signal;

    const outcomes: unknown[] = [await flow.requestCodeAsync(Date.now(), signal).then(() => null, failureOf),
      await flow.pollAsync(grant.device_code, signal).then(() => null, failureOf), await flow.readAccountAsync("gho_token", signal).then(() => null, failureOf)];

    assert.deepEqual([outcomes, github.urls(), github.requests.map(t => t.init.redirect)], [
      ["SignInRequestRefusedException", "SignInRequestRefusedException", "SignInRequestRefusedException"],
      ["https://github.com/login/device/code", "https://github.com/login/oauth/access_token", "https://api.github.com/user"], ["manual", "manual", "manual"]]);
  });
});
