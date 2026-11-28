/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import "@noldova/context.core";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { afterEach, describe, it, vi } from "vitest";

import { GitHubAvatars } from "../../src/services/github-avatars.ts";
import { FakeGitHub, linesOf } from "../fixtures/fake-github.fixture.ts";

const signal: AbortSignal = new AbortController().signal;
const address = "https://avatars.githubusercontent.com/u/583231?v=4";
const sized = "https://avatars.githubusercontent.com/u/583231?v=4&s=64";
const pixel: Uint8Array<ArrayBuffer> = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

function image(bytes: Uint8Array<ArrayBuffer> = pixel, type: string = "image/png"): Response {
  return new Response(new Blob([bytes]), { status: 200, headers: { "Content-Type": type } });
}

function redirect(location: string | null, status: number = 302, body: string | null = "Moved."): Response {
  return new Response(body, { status, headers: Object.isNull(location) ? {} : { Location: location } });
}

function dataOf(bytes: Uint8Array<ArrayBuffer> = pixel, type: string = "image/png"): string {
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}

class Rig {
  public readonly github: FakeGitHub = new FakeGitHub();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly avatars: GitHubAvatars = new GitHubAvatars(this.github.fetch, this.log);
}

describe("GitHubAvatars", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads an avatar at 64 pixels as a data address, sends no token or cookie, and keeps it for the next read", async () => {
    const rig = new Rig();
    rig.github.answer(image());

    const avatars = [await rig.avatars.readAsync(address, signal), await rig.avatars.readAsync(address, signal)];

    const request = rig.github.requests[0];
    assert.deepEqual(avatars, [dataOf(), dataOf()]);
    assert.deepEqual(rig.github.urls(), [sized]);
    assert.deepEqual([request?.header("Authorization"), request?.header("Cookie"), request?.header("User-Agent"), request?.header("Accept"), request?.init.redirect],
      [null, null, "Noldova-Git", "image/png, image/jpeg, image/gif, image/webp", "manual"]);
  });

  it("takes a PNG, JPEG, GIF or WebP image of up to 64 KiB, whatever the type's case or parameters", async () => {
    const rig = new Rig();
    const largest = new Uint8Array(65_536).fill(7);
    rig.github.answer(image(pixel, "image/jpeg; charset=binary"), image(pixel, "IMAGE/GIF"), image(pixel, "image/webp"), image(largest));

    const avatars: (string | null)[] = [];
    for (const number of [1, 2, 3, 4])
      avatars.push(await rig.avatars.readAsync(`https://avatars.githubusercontent.com/u/${number}`, signal));

    assert.deepEqual(avatars, [dataOf(pixel, "image/jpeg"), dataOf(pixel, "image/gif"), dataOf(pixel, "image/webp"), dataOf(largest)]);
  });

  it("answers null without asking for no address or one off GitHub's avatar host, over http, with a user or a port", async () => {
    const rig = new Rig();

    const avatars: (string | null)[] = [];
    for (const refused of [null, "https://example.com/u/583231", "http://avatars.githubusercontent.com/u/583231", "https://a:b@avatars.githubusercontent.com/u/1",
      "https://avatars.githubusercontent.com:8443/u/1", "https://avatars.githubusercontent.com.example.com/u/1", "avatar.png"])
      avatars.push(await rig.avatars.readAsync(refused, signal));

    assert.deepEqual([avatars, rig.github.requests.length], [Array.from({ length: 7 }, () => null), 0]);
  });

  it("answers null for a refused answer, another type, an empty or oversized body, a body that breaks or no connection, logs why, and asks again next time", async () => {
    const rig = new Rig();
    const broken = new ReadableStream<Uint8Array>({
      pull: controller => controller.error(new TypeError("terminated"))
    });
    const refused: readonly Response[] = [FakeGitHub.json({}, 404), image(pixel, "image/svg+xml"), new Response(pixel, { status: 200 })];
    rig.github.answer(...refused, image(new Uint8Array(0)), image(new Uint8Array(65_537)), new Response(null, { status: 200, headers: { "Content-Type": "image/png" } }),
      new Response(broken, { status: 200, headers: { "Content-Type": "image/png" } }));
    rig.github.fail(new TypeError("fetch failed"));
    rig.github.answer(image());

    const avatars: (string | null)[] = [];
    for (let attempt = 0; attempt < 9; attempt++)
      avatars.push(await rig.avatars.readAsync(address, signal));

    assert.deepEqual(avatars, [...Array.from({ length: 8 }, () => null), dataOf()]);
    assert.deepEqual(rig.github.urls(), Array.from({ length: 9 }, () => sized));
    assert.deepEqual(refused.map(t => t.bodyUsed), [true, true, true]);
    assert.deepEqual(linesOf(rig.log), ["the avatar server answered 404", "the answer isn't a PNG, JPEG, GIF or WebP image", "the answer isn't a PNG, JPEG, GIF or WebP image",
      "the image is empty", "the image is over 64 KiB", "the answer isn't a PNG, JPEG, GIF or WebP image", "TypeError: terminated", "TypeError: fetch failed"]
      .map(t => `A GitHub avatar isn't shown: ${t}.`));
  });

  it("passes on a failure that is neither the network's nor the deadline's, while asking or while reading the body", async () => {
    const rig = new Rig();
    const unexpected = new RangeError("Unexpected.");
    const broken = new ReadableStream<Uint8Array>({
      pull: controller => controller.error(unexpected)
    });
    rig.github.fail(unexpected);
    rig.github.answer(new Response(broken, { status: 200, headers: { "Content-Type": "image/png" } }));

    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 2; attempt++)
      failures.push(await rig.avatars.readAsync(address, signal).then(() => null, (error: unknown) => error));

    assert.deepEqual([failures, linesOf(rig.log)], [[unexpected, unexpected], []]);
  });

  it("stops reading a body once it passes 64 KiB, cancelling it with no more than the chunk that passed the cap read", async () => {
    const rig = new Rig();
    let pulled = 0;
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull: controller => {
        pulled++;
        controller.enqueue(new Uint8Array(16_384));
      },
      cancel: () => {
        cancelled = true;
      }
    }, { highWaterMark: 0 });
    rig.github.answer(new Response(endless, { status: 200, headers: { "Content-Type": "image/png" } }));

    const avatar = await rig.avatars.readAsync(address, signal);

    assert.deepEqual([avatar, cancelled, pulled], [null, true, 5]);
  });

  it("gives the whole read, redirects included, five seconds, then answers null, logs it and asks again next time", async () => {
    vi.useFakeTimers();
    const rig = new Rig();
    rig.github.answer(redirect("/u/2"));
    rig.github.hold();
    rig.github.answer(image());

    let settled = false;
    const reading: Promise<string | null> = rig.avatars.readAsync(address, signal).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    const early = settled;
    await vi.advanceTimersByTimeAsync(1);
    const avatar = await reading;
    const again = await rig.avatars.readAsync(address, signal);

    assert.deepEqual([early, avatar, again, rig.github.urls().length, vi.getTimerCount()], [false, null, dataOf(), 3, 0]);
    assert.deepEqual(linesOf(rig.log), ["A GitHub avatar isn't shown: it didn't arrive within 5 seconds."]);
  });

  it("follows up to three redirects on GitHub's avatar host, and answers null for one elsewhere, without a place or past the third, logging each", async () => {
    const rig = new Rig();
    const redirects: readonly Response[] = [redirect("/u/1?s=64", 301), redirect("https://avatars.githubusercontent.com/u/2", 307, null), redirect("/u/3", 308)];
    const elsewhere: readonly Response[] = [redirect("https://example.com/u/1"), redirect(null), redirect("/u/4", 303), redirect("/u/5"), redirect("/u/6"),
      redirect("/u/7")];
    rig.github.answer(...redirects, image(), ...elsewhere);

    const avatars = [await rig.avatars.readAsync("https://avatars.githubusercontent.com/u/10", signal),
      await rig.avatars.readAsync("https://avatars.githubusercontent.com/u/11", signal),
      await rig.avatars.readAsync("https://avatars.githubusercontent.com/u/12", signal),
      await rig.avatars.readAsync("https://avatars.githubusercontent.com/u/13", signal)];

    assert.deepEqual(avatars, [dataOf(), null, null, null]);
    assert.deepEqual(rig.github.urls(), ["https://avatars.githubusercontent.com/u/10?s=64", "https://avatars.githubusercontent.com/u/1?s=64",
      "https://avatars.githubusercontent.com/u/2", "https://avatars.githubusercontent.com/u/3", "https://avatars.githubusercontent.com/u/11?s=64",
      "https://avatars.githubusercontent.com/u/12?s=64", "https://avatars.githubusercontent.com/u/13?s=64", "https://avatars.githubusercontent.com/u/4",
      "https://avatars.githubusercontent.com/u/5", "https://avatars.githubusercontent.com/u/6"]);
    assert.ok(rig.github.requests.every(t => Object.isNull(t.header("Authorization")) && t.init.redirect === "manual"));
    assert.deepEqual(linesOf(rig.log), Array.from({ length: 3 }, () => "A GitHub avatar isn't shown: the avatar server redirected more than 3 times, or off its host."));
    assert.deepEqual([...redirects, ...elsewhere].map(t => t.bodyUsed), [true, false, true, true, true, true, true, true, true]);
  });

  it("fails with the cancel's reason when the read is cancelled while asking or while reading the body", async () => {
    const rig = new Rig();
    const asking = new AbortController();
    const reading = new AbortController();
    let waiting: () => void = () => undefined;
    const reached = new Promise<void>(resolve => {
      waiting = resolve;
    });
    let pulls = 0;
    const endless = new ReadableStream<Uint8Array>({
      start: controller => reading.signal.addEventListener("abort", () => controller.error(reading.signal.reason), { once: true }),
      pull: controller => {
        if (pulls++ === 0)
          controller.enqueue(pixel);
        else
          waiting();
      }
    });
    rig.github.hold();
    rig.github.answer(new Response(endless, { status: 200, headers: { "Content-Type": "image/png" } }));

    const asked: Promise<unknown> = rig.avatars.readAsync(address, asking.signal).then(() => null, (error: unknown) => error);
    asking.abort(new Error("Stopped while asking."));
    const read: Promise<unknown> = rig.avatars.readAsync("https://avatars.githubusercontent.com/u/2", reading.signal).then(() => null, (error: unknown) => error);
    await reached;
    reading.abort(new Error("Stopped while reading."));

    assert.deepEqual([String(await asked), String(await read)], ["Error: Stopped while asking.", "Error: Stopped while reading."]);
  });

  it("keeps the last 500 avatars it read, the most recently read last", async () => {
    const rig = new Rig();
    const addressOf = (number: number): string => `https://avatars.githubusercontent.com/u/${number}`;
    for (let number = 0; number < 502; number++)
      rig.github.answer(image(Uint8Array.from([number % 256])));

    for (let number = 0; number < 500; number++)
      await rig.avatars.readAsync(addressOf(number), signal);
    await rig.avatars.readAsync(addressOf(0), signal);
    await rig.avatars.readAsync(addressOf(500), signal);
    const kept = await rig.avatars.readAsync(addressOf(0), signal);
    const asked = rig.github.requests.length;
    const dropped = await rig.avatars.readAsync(addressOf(1), signal);

    assert.deepEqual([kept, asked, dropped, rig.github.requests.length], [dataOf(Uint8Array.from([0])), 501, dataOf(Uint8Array.from([501 % 256])), 502]);
  });
});
