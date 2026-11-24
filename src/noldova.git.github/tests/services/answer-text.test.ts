/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { AnswerText } from "../../src/services/answer-text.ts";

function streamOf(...chunks: readonly Uint8Array[]): { readonly response: Response; readonly isCancelled: () => boolean } {
  let cancelled: boolean = false;
  let index: number = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller: ReadableStreamDefaultController<Uint8Array>): void {
      const next: Uint8Array | undefined = chunks[index];
      index += 1;
      if (next === undefined)
        controller.close();
      else
        controller.enqueue(next);
    },
    cancel(): void {
      cancelled = true;
    }
  });
  return { response: new Response(body), isCancelled: () => cancelled };
}

describe("AnswerText", () => {
  it("reads the body as UTF-8 across chunks that split a character, up to the limit exactly, and an empty or absent body as empty text", async () => {
    const bytes: Buffer = Buffer.from("{\"login\":\"あい\"}");
    const split = streamOf(bytes.subarray(0, 11), bytes.subarray(11));

    const texts = [await AnswerText.readAsync(split.response, bytes.length), await AnswerText.readAsync(new Response(""), 0),
      await AnswerText.readAsync(new Response(null), 0)];

    assert.deepEqual([texts, split.isCancelled()], [["{\"login\":\"あい\"}", "", ""], false]);
  });

  it("answers null and lets go of the rest once the body passes the limit, reading no further chunk", async () => {
    const over = streamOf(new Uint8Array(4), new Uint8Array(4), new Uint8Array(4));

    const text: string | null = await AnswerText.readAsync(over.response, 7);

    assert.deepEqual([text, over.isCancelled()], [null, true]);
  });

  it("passes on a failure of the read as it is", async () => {
    const broken = new Error("The connection broke.");
    const body = new ReadableStream<Uint8Array>({
      pull(controller: ReadableStreamDefaultController<Uint8Array>): void {
        controller.error(broken);
      }
    });

    const failure: unknown = await AnswerText.readAsync(new Response(body), 1024).then(() => null, (error: unknown) => error);

    assert.equal(failure, broken);
  });
});
