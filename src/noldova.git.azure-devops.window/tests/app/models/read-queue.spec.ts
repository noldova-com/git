/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { describe, expect, it, vi } from "vitest";

import { ReadQueue } from "../../../src/app/models/read-queue.ts";
import { UnhandledRejections } from "../../fixtures/unhandled-rejections.fixture.ts";

class HeldRead {
  public resolve: () => void = () => undefined;
  public reject: (error: Error) => void = () => undefined;
}

describe("ReadQueue", () => {
  it("runs at most its limit of reads at once and starts the next waiting read as each ends, a failed one too, passing the failure on", async () => {
    const queue = new ReadQueue(2);
    const started: number[] = [];
    const held: HeldRead[] = [];
    for (const number of [1, 2, 3, 4])
      queue.add(() => {
        started.push(number);
        const read = new HeldRead();
        held.push(read);
        return new Promise<void>((resolve, reject) => {
          read.resolve = resolve;
          read.reject = reject;
        });
      });
    const atFirst = [...started];

    held[0]?.resolve();
    await vi.waitFor(() => expect(started).toEqual([1, 2, 3]));
    const rejected = UnhandledRejections.nextAsync();
    const failure = new RangeError("Unexpected.");
    held[1]?.reject(failure);
    await vi.waitFor(() => expect(started).toEqual([1, 2, 3, 4]));

    expect([atFirst, await rejected]).toEqual([[1, 2], failure]);
  });
});
