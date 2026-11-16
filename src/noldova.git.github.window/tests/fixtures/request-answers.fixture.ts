/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";

export class RequestAnswers {
  private readonly context: FakeWindowPartContext;
  private readonly queues: Map<string, (() => Promise<JsonValue>)[]> = new Map();
  private readonly waiters: { readonly count: number; readonly resolve: () => void }[] = [];

  public readonly answered: Promise<JsonValue>[] = [];

  public constructor(context: FakeWindowPartContext) {
    this.context = context;
    context.answer("requestAsync", method => {
      const next = this.queue(method).shift();
      const reply: Promise<JsonValue> = next === undefined ? Promise.reject(new UnansweredCallException("requestAsync")) : next();
      this.answered.push(reply);
      for (const waiter of this.waiters.filter(t => t.count <= this.answered.length)) {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve();
      }
      return reply;
    });
  }

  public get methods(): readonly unknown[] {
    return this.context.callsOf("requestAsync").map(t => t[0]);
  }

  public get payloads(): readonly unknown[] {
    return this.context.callsOf("requestAsync").map(t => t[1]);
  }

  public askedAsync(count: number): Promise<void> {
    return this.answered.length >= count ? Promise.resolve() : new Promise<void>(resolve => {
      this.waiters.push({ count, resolve });
    });
  }

  public answer(method: string, ...payloads: JsonValue[]): void {
    this.queue(method).push(...payloads.map(t => () => Promise.resolve(t)));
  }

  public fail(method: string, error: Error): void {
    this.queue(method).push(() => Promise.reject(error));
  }

  public hold(method: string): (payload: JsonValue) => void {
    let release: (payload: JsonValue) => void = () => undefined;
    const held = new Promise<JsonValue>(resolve => {
      release = resolve;
    });
    this.queue(method).push(() => held);
    return release;
  }

  public holdFailure(method: string): (error: Error) => void {
    let reject: (error: Error) => void = () => undefined;
    const held = new Promise<JsonValue>((_, fail) => {
      reject = fail;
    });
    this.queue(method).push(() => held);
    return reject;
  }

  private queue(method: string): (() => Promise<JsonValue>)[] {
    const queue = this.queues.get(method) ?? [];
    this.queues.set(method, queue);
    return queue;
  }
}
