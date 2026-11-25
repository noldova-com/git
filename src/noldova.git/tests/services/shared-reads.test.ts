/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { KeyQueue } from "../../src/services/key-queue.ts";
import { SharedReads } from "../../src/services/shared-reads.ts";

/** A read held in a queue until the test releases it, and its end. */
interface IBlockedRead {
  readonly release: () => void;
  readonly done: Promise<void>;
}

describe("SharedReads", () => {
  const blocked = (queue: KeyQueue, top: string): IBlockedRead => {
    const gate = Promise.withResolvers<void>();
    return { release: () => gate.resolve(), done: queue.runAsync(top, () => gate.promise) };
  };

  test("runs a read once for the callers that ask for it while it waits, and again for one that asks once it has started", async () => {
    const queue = new KeyQueue();
    const reads = new SharedReads(queue);
    const busy = blocked(queue, "/r");
    let runs = 0;
    const started = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    const read = async (): Promise<number> => {
      runs += 1;
      started.resolve();
      await finish.promise;
      return runs;
    };

    const waiting = [reads.runAsync("/r", "status", new AbortController().signal, read), reads.runAsync("/r", "status", new AbortController().signal, read)];
    busy.release();
    await started.promise;
    const late = reads.runAsync("/r", "status", new AbortController().signal, read);
    finish.resolve();

    assert.deepEqual(await Promise.all([...waiting, late]), [1, 1, 2]);
    await busy.done;
  });

  test("keeps different reads and different repositories apart", async () => {
    const reads = new SharedReads(new KeyQueue());
    const seen: string[] = [];
    const read = (name: string) => async (): Promise<string> => {
      seen.push(name);
      return name;
    };

    const answers = await Promise.all([
      reads.runAsync("/r", "status", new AbortController().signal, read("r status")),
      reads.runAsync("/r", "graph", new AbortController().signal, read("r graph")),
      reads.runAsync("/s", "status", new AbortController().signal, read("s status"))
    ]);

    assert.deepEqual([answers, seen.toSorted()], [["r status", "r graph", "s status"], ["r graph", "r status", "s status"]]);
  });

  test("rejects a caller that cancels, keeps the read for the others, and cancels it only when every caller has", async () => {
    const queue = new KeyQueue();
    const reads = new SharedReads(queue);
    const busy = blocked(queue, "/r");
    const signals: AbortSignal[] = [];
    const read = async (signal: AbortSignal): Promise<string> => {
      signals.push(signal);
      return "read";
    };
    const [first, second] = [new AbortController(), new AbortController()];
    const kept = reads.runAsync("/r", "status", first.signal, read);
    const left = reads.runAsync("/r", "status", second.signal, read);
    second.abort(new Error("Left."));

    const [leftOutcome] = await Promise.allSettled([left]);
    busy.release();

    assert.deepEqual([leftOutcome?.status, await kept, signals.map(t => t.aborted)], ["rejected", "read", [false]]);
    await busy.done;
  });

  test("cancels a started read when its only caller cancels", async () => {
    const reads = new SharedReads(new KeyQueue());
    const started = Promise.withResolvers<void>();
    const seen: AbortSignal[] = [];
    const read = async (signal: AbortSignal): Promise<string> => {
      seen.push(signal);
      started.resolve();
      await new Promise<void>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
      return "never";
    };
    const caller = new AbortController();
    const running = reads.runAsync("/r", "status", caller.signal, read);
    await started.promise;
    caller.abort(new Error("Gone."));

    const [outcome] = await Promise.allSettled([running]);
    assert.deepEqual([outcome?.status, seen.map(t => t.aborted)], ["rejected", [true]]);
  });

  test("never runs a read every caller cancelled before it started, and starts afresh for the next caller", async () => {
    const queue = new KeyQueue();
    const reads = new SharedReads(queue);
    const busy = blocked(queue, "/r");
    let runs = 0;
    const read = async (): Promise<number> => ++runs;
    const caller = new AbortController();
    const cancelled = reads.runAsync("/r", "status", caller.signal, read);
    caller.abort(new Error("Gone."));
    const next = reads.runAsync("/r", "status", new AbortController().signal, read);
    busy.release();

    const [outcome] = await Promise.allSettled([cancelled]);
    assert.deepEqual([outcome?.status, await next, runs], ["rejected", 1, 1]);
    await busy.done;
  });

  test("refuses a caller whose signal is already cancelled without queueing a read", async () => {
    const reads = new SharedReads(new KeyQueue());
    let runs = 0;

    await assert.rejects(reads.runAsync("/r", "status", AbortSignal.abort(new Error("Before.")), async () => ++runs), /Before\./u);
    assert.equal(runs, 0);
  });
});
