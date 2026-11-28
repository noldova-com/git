/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import "@noldova/context.core";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { afterEach, describe, it, vi } from "vitest";

import { GravatarReader } from "../../src/services/gravatar.reader.ts";

type Answer = Response | Error | ((init: RequestInit) => Promise<Response>);

const signal: AbortSignal = new AbortController().signal;
const pixel: Uint8Array<ArrayBuffer> = Uint8Array.from([137, 80, 78, 71]);
const pixelData = "data:image/png;base64,iVBORw==";
const hash: string = createHash("sha256").update("kim@example.com").digest("hex");

function image(bytes: Uint8Array<ArrayBuffer> = pixel, type: string = "image/png"): Response {
  return new Response(new Blob([bytes]), { status: 200, headers: { "Content-Type": type } });
}

function broken(error: unknown): Response {
  return new Response(new ReadableStream({ pull: controller => controller.error(error) }), { status: 200, headers: { "Content-Type": "image/png" } });
}

function waitForAbort(init: RequestInit, failure: (signal: AbortSignal) => unknown): Promise<Response> {
  return new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(failure(init.signal ?? AbortSignal.abort()))));
}

interface IAskedFetch {
  readonly url: string;
  readonly init: RequestInit;
}

class Rig {
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly asked: IAskedFetch[] = [];
  public readonly answers: Answer[] = [];
  public readonly reader: GravatarReader = new GravatarReader(async (url, init) => {
    this.asked.push({ url, init });
    const answer: Answer | undefined = this.answers.shift();
    if (Object.isUndefined(answer))
      throw new Error("No answer is left.");
    if (answer instanceof Error)
      throw answer;
    return answer instanceof Response ? answer : answer(init);
  }, this.log);

  public get lines(): readonly string[] {
    return this.log.callsOf("write").map(([message]) => String(message));
  }
}

describe("GravatarReader", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for the email's SHA-256 at 64 pixels and for no stand-in, whatever its case or spaces, without following a redirect, and keeps the picture", async () => {
    const rig = new Rig();
    rig.answers.push(image());

    const images = [await rig.reader.readAsync(" Kim@Example.com", signal), await rig.reader.readAsync("kim@example.com", signal)];

    const headers = new Headers(rig.asked[0]?.init.headers);
    assert.deepEqual(images, [pixelData, pixelData]);
    assert.deepEqual(rig.asked.map(t => t.url), [`https://www.gravatar.com/avatar/${hash}?s=64&d=404`]);
    assert.deepEqual([headers.get("Accept"), headers.get("User-Agent"), headers.get("Authorization"), rig.asked[0]?.init.redirect],
      ["image/png, image/jpeg, image/gif, image/webp", "Noldova-Git", null, "error"]);
  });

  it("answers null for an email Gravatar has no picture for, keeps that and logs nothing", async () => {
    const rig = new Rig();
    rig.answers.push(new Response("Not found", { status: 404 }));

    const images = [await rig.reader.readAsync("kim@example.com", signal), await rig.reader.readAsync("kim@example.com", signal)];

    assert.deepEqual([images, rig.asked.length, rig.lines], [[null, null], 1, []]);
  });

  it("takes a PNG, JPEG, GIF or WebP image of up to 64 KiB, whatever the type's case or parameters", async () => {
    const rig = new Rig();
    rig.answers.push(image(pixel, "IMAGE/JPEG; charset=binary"), image(new Uint8Array(65_536).fill(7), "image/webp"), image(pixel, "image/gif"));

    const images = [
      await rig.reader.readAsync("a@example.com", signal), await rig.reader.readAsync("b@example.com", signal), await rig.reader.readAsync("c@example.com", signal)
    ];

    assert.deepEqual(images.map(t => t?.split(",", 1).join("")), ["data:image/jpeg;base64", "data:image/webp;base64", "data:image/gif;base64"]);
    assert.equal(images[1]?.length, "data:image/webp;base64,".length + Math.ceil(65_536 / 3) * 4);
  });

  it("answers null for a refused answer, another type, no body, an empty, oversized or breaking body or no connection, logs why, and asks again next time", async () => {
    const rig = new Rig();
    rig.answers.push(new Response("Busy", { status: 503 }), image(pixel, "image/svg+xml"), new Response(null, { status: 200, headers: { "Content-Type": "image/png" } }),
      image(new Uint8Array(0)), image(new Uint8Array(65_537)), broken(new TypeError("terminated")), new TypeError("fetch failed"), image());

    const images: (string | null)[] = [];
    for (let i = 0; i < 8; i++)
      images.push(await rig.reader.readAsync("kim@example.com", signal));

    assert.deepEqual(images, [null, null, null, null, null, null, null, pixelData]);
    assert.deepEqual(rig.lines, [
      "A Gravatar picture isn't shown: Gravatar answered 503.",
      "A Gravatar picture isn't shown: the answer isn't a PNG, JPEG, GIF or WebP image.",
      "A Gravatar picture isn't shown: the answer isn't a PNG, JPEG, GIF or WebP image.",
      "A Gravatar picture isn't shown: the image is empty.",
      "A Gravatar picture isn't shown: the image is over 64 KiB.",
      "A Gravatar picture isn't shown: TypeError: terminated.",
      "A Gravatar picture isn't shown: TypeError: fetch failed."
    ]);
  });

  it("passes on a failure that is neither the network's nor the deadline's, while asking or while reading the body", async () => {
    const rig = new Rig();
    rig.answers.push(new RangeError("asking"), broken(new RangeError("reading")));

    await assert.rejects(rig.reader.readAsync("kim@example.com", signal), { name: "RangeError", message: "asking" });
    await assert.rejects(rig.reader.readAsync("kim@example.com", signal), { name: "RangeError", message: "reading" });
  });

  it("gives the read five seconds, then answers null, logs it and asks again next time", async () => {
    vi.useFakeTimers();
    const rig = new Rig();
    rig.answers.push(init => waitForAbort(init, t => t.reason), image());

    const reading = rig.reader.readAsync("kim@example.com", signal);
    await vi.advanceTimersByTimeAsync(4_999);
    const early: readonly string[] = rig.lines;
    await vi.advanceTimersByTimeAsync(1);

    assert.deepEqual([early, await reading, rig.lines], [[], null, ["A Gravatar picture isn't shown: it didn't arrive within 5 seconds."]]);
    assert.equal(await rig.reader.readAsync("kim@example.com", signal), pixelData);
  });

  it("fails with the cancel's reason when the read is cancelled, logging nothing", async () => {
    const rig = new Rig();
    const cancel = new AbortController();
    rig.answers.push(init => waitForAbort(init, () => new TypeError("aborted")));

    const reading = rig.reader.readAsync("kim@example.com", cancel.signal);
    cancel.abort(new Error("Closed."));

    await assert.rejects(reading, { message: "Closed." });
    assert.deepEqual(rig.lines, []);
  });

  it("keeps the last 500 answers it read, the most recently read last", async () => {
    const rig = new Rig();
    for (let i = 0; i < 503; i++)
      rig.answers.push(new Response(null, { status: 404 }));

    for (let i = 0; i < 501; i++)
      await rig.reader.readAsync(`${i}@example.com`, signal);
    const afterFill: number = rig.asked.length;
    await rig.reader.readAsync("1@example.com", signal);
    await rig.reader.readAsync("0@example.com", signal);

    assert.deepEqual([afterFill, rig.asked.length, rig.asked.at(-1)?.url.includes(createHash("sha256").update("0@example.com").digest("hex"))], [501, 502, true]);
  });
});
