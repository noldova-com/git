/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { EventChannel, type IMethodHandler, ServiceMissingException, ServiceTypeMismatchException } from "@noldova/desktop.runtime";
import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";

import { KeptSecrets } from "./fake-github.fixture.ts";
import { ServedTools } from "./served-tools.fixture.ts";

export class RuntimeContext {
  public readonly fake: FakeRuntimePartContext = new FakeRuntimePartContext();
  public readonly secrets: KeptSecrets = new KeptSecrets(this.fake.secrets);
  public readonly tools: ServedTools = new ServedTools(this.fake.tools, this.fake.log);
  public readonly methods: Map<string, IMethodHandler> = new Map();
  public readonly services: Map<string, object> = new Map();
  public readonly events: Map<string, JsonValue[]> = new Map();

  public constructor() {
    this.fake.answer("registerMethod", (name, handler) => void this.methods.set(name, handler));
    this.fake.answer("declareEvent", name => {
      const published: JsonValue[] = [];
      this.events.set(name, published);
      return new EventChannel(payload => published.push(payload), () => this.events.delete(name));
    });
    this.fake.answer("getService", (name, type) => {
      const service: object | undefined = this.services.get(name);
      if (Object.isUndefined(service))
        throw new ServiceMissingException(name);
      if (!(service instanceof type))
        throw new ServiceTypeMismatchException(name, type.name);
      return service;
    });
    this.fake.beStrict();
    this.fake.allow("publishService");
    this.fake.log.allow("write");
    this.fake.appWindows.allow("onChanged");
  }

  public published(name: string): unknown {
    return this.fake.callsOf("publishService").find(([published]) => published === name)?.[1];
  }

  public publishedNames(): readonly unknown[] {
    return this.fake.callsOf("publishService").map(([name]) => name);
  }
}
