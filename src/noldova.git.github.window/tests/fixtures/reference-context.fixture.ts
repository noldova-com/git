/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";

import { RecordedRequest } from "./recorded-request.fixture.ts";

/** A window part context that answers each module method with its own handler and records the requests, events and log lines a test checks. */
export class ReferenceContext extends FakeWindowPartContext {
  private readonly handlers: Map<string, (parameters: JsonValue) => JsonValue | Promise<JsonValue>> = new Map();

  public readonly requests: RecordedRequest[] = [];

  public constructor() {
    super();
    this.answer("requestAsync", async (method: string, parameters: JsonValue) => {
      this.requests.push(new RecordedRequest(method, parameters));
      const handler = this.handlers.get(method);
      if (handler === undefined)
        throw new UnansweredCallException(method);
      return handler(parameters);
    });
    this.answer("log", () => undefined);
  }

  public get methods(): readonly string[] {
    return this.requests.map(t => t.method);
  }

  public get lines(): readonly string[] {
    return this.callsOf("log").map(t => String(t[0]));
  }

  public get heardEvents(): readonly string[] {
    return this.activeCallsOf("onEvent").map(t => String(t[0]));
  }

  public get dependencyListeners(): number {
    return this.activeCallsOf("onDependencyChanged").length;
  }

  public answerModule(method: string, handler: (parameters: JsonValue) => JsonValue | Promise<JsonValue>): this {
    this.handlers.set(method, handler);
    return this;
  }

  public emitModule(event: string, payload: JsonValue): void {
    this.raiseEvent(event, payload);
  }

  public changeDependency(moduleId: string, isActive: boolean): void {
    this.raiseDependencyChanged(moduleId, isActive);
  }
}
