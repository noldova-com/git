/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { EventChannel, type IMethodHandler } from "@noldova/desktop.runtime";
import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";

import { KeptSecrets } from "./fake-azure.fixture.ts";

export class RuntimeContext {
  public readonly fake: FakeRuntimePartContext = new FakeRuntimePartContext();
  public readonly secrets: KeptSecrets = new KeptSecrets(this.fake.secrets);
  public readonly methods: Map<string, IMethodHandler> = new Map();
  public readonly events: Map<string, JsonValue[]> = new Map();

  public constructor() {
    this.fake.answer("registerMethod", (name, handler) => void this.methods.set(name, handler));
    this.fake.answer("declareEvent", name => {
      const published: JsonValue[] = [];
      this.events.set(name, published);
      return new EventChannel(payload => published.push(payload), () => this.events.delete(name));
    });
    this.fake.beStrict();
    this.fake.log.allow("write");
    this.fake.appWindows.allow("onChanged");
  }
}
