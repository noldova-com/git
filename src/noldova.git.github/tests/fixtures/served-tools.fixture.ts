/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";

import { type JsonObject, JsonReader } from "@noldova/context.json";
import { PermissionCenter, ToolDescriptor, ToolRegistry, type ToolSession } from "@noldova/desktop.runtime";
import { FakeModuleLog, FakeToolsContext } from "@noldova/desktop.runtime/testing";

const declaration: JsonReader = JsonReader.parse(readFileSync(new URL("../../module.json", import.meta.url), "utf8"));
const moduleId: string = declaration.readString("id");
const tools: readonly string[] = declaration.readObject("contributes").readStringArray("tools");

export class ServedTools {
  private sessions: number = 0;
  public readonly fake: FakeToolsContext;
  public readonly log: FakeModuleLog;
  public readonly permissions: PermissionCenter = new PermissionCenter("app");
  public readonly registry: ToolRegistry = new ToolRegistry(() => `session-${++this.sessions}`, undefined, this.permissions);

  public constructor(fake: FakeToolsContext = new FakeToolsContext(), log: FakeModuleLog = new FakeModuleLog()) {
    this.fake = fake;
    this.log = log;
    fake.answer("register", (descriptor, handler) => this.registry.register(moduleId, new ToolDescriptor(descriptor, tools), handler,
      tools, this.log));
  }

  public openSession(scope: string, bindings: JsonObject): ToolSession {
    return this.registry.openSession(scope, bindings);
  }
}
