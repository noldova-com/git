/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";

import { GitFixtures } from "./git-fixtures.fixture.ts";

export class GitHeldRequests {
  private readonly arrived: Map<string, ((answer: JsonValue | Error) => void)[]> = new Map();
  private readonly claims: Map<string, ((settle: (answer: JsonValue | Error) => void) => void)[]> = new Map();

  public constructor(context: FakeWindowPartContext, held: readonly string[], answers: Readonly<Record<string, JsonValue | Error | (() => JsonValue | Error)>> = {}) {
    context.answer("requestAsync", async method => {
      if (!held.includes(method))
        return GitFixtures.answerFor(answers, method);
      const answer: JsonValue | Error = await new Promise<JsonValue | Error>(resolve => this.arrive(method, resolve));
      if (answer instanceof Error)
        throw answer;
      return answer;
    });
  }

  public nextAsync(method: string): Promise<(answer: JsonValue | Error) => void> {
    const settle: ((answer: JsonValue | Error) => void) | undefined = this.arrived.get(method)?.shift();
    if (!Object.isUndefined(settle))
      return Promise.resolve(settle);
    return new Promise(resolve => this.claims.set(method, [...this.claims.get(method) ?? [], resolve]));
  }

  public async answerAsync(method: string, answer: JsonValue | Error): Promise<void> {
    const settle: (answer: JsonValue | Error) => void = await this.nextAsync(method);
    settle(answer);
  }

  private arrive(method: string, settle: (answer: JsonValue | Error) => void): void {
    const claim: ((settle: (answer: JsonValue | Error) => void) => void) | undefined = this.claims.get(method)?.shift();
    if (Object.isUndefined(claim))
      this.arrived.set(method, [...this.arrived.get(method) ?? [], settle]);
    else
      claim(settle);
  }
}
