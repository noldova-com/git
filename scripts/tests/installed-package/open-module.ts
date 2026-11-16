/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { DataDirectory, EventChannel, ModuleDatabase } from "@noldova/desktop.runtime";
import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";

import { InstalledPackageCheckFailedException } from "../../exceptions/installed-package-check-failed.exception.ts";
import type { IInstalledRuntimePart } from "../../interfaces/i-installed-runtime-part.ts";
import { InstalledPackageResources } from "./installed-package-resources.ts";

class OpenModule {
  public static async runAsync(name: string | undefined): Promise<void> {
    if (name === undefined)
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.runtimeMissing);
    const runtime: { readonly RuntimePart: new () => IInstalledRuntimePart } = await import(name);
    const part: IInstalledRuntimePart = new runtime.RuntimePart();
    const folder: string = await mkdtemp(path.join(tmpdir(), InstalledPackageResources.openWorkPrefix));
    const database: ModuleDatabase = await ModuleDatabase.openAsync(new DataDirectory(folder), InstalledPackageResources.databaseName, part.migrations ?? []);
    const context: FakeRuntimePartContext = OpenModule.contextOf(database);
    const states: boolean[] = [part.isActive];
    try {
      await part.activateAsync(context);
      states.push(part.isActive);
      await part.deactivateAsync();
      states.push(part.isActive);
    }
    finally {
      database.close();
      await rm(folder, { recursive: true, force: true });
    }
    OpenModule.report(name, context, states);
  }

  private static contextOf(database: ModuleDatabase): FakeRuntimePartContext {
    const context: FakeRuntimePartContext = new FakeRuntimePartContext();
    context.answer("declareEvent", () => new EventChannel(() => undefined, () => undefined));
    context.database.answer("read", database.read.bind(database));
    context.database.answer("readAll", database.readAll.bind(database));
    context.database.answer("run", database.run.bind(database));
    context.database.answer("transaction", database.transaction.bind(database));
    context.secrets.answer("readAsync", () => Promise.resolve(null));
    context.beStrict();
    context.allow("registerMethod", "publishService", "onClientClosed");
    context.log.allow("write");
    context.tools.allow("register");
    context.appWindows.allow("onChanged");
    return context;
  }

  private static report(name: string, context: FakeRuntimePartContext, states: readonly boolean[]): void {
    const separator: string = InstalledPackageResources.listSeparator;
    const logged: readonly string[] = context.log.callsOf("write").map(t => String(t[0]));
    const methods: readonly string[] = context.callsOf("registerMethod").map(t => String(t[0]));
    const services: readonly string[] = context.callsOf("publishService").map(t => String(t[0]));
    const tools: readonly string[] = context.tools.callsOf("register").map(t => OpenModule.nameOf(t[0]));
    const kept: readonly string[] = context.tools.activeCallsOf("register").map(t => OpenModule.nameOf(t[0]));
    if (states.join() !== InstalledPackageResources.expectedStates)
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.formatActivityDiffers(states.join(separator),
        logged.join(InstalledPackageResources.logSeparator)));
    if (kept.length > 0)
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.formatToolsKept(tools.join(separator), kept.join(separator)));
    console.log(InstalledPackageResources.formatOpened(name,
      methods.length === 0 ? InstalledPackageResources.noMethods : methods.join(separator),
      tools.length === 0 ? InstalledPackageResources.noTools : InstalledPackageResources.formatTools(tools.join(separator)),
      services.length === 0 ? InstalledPackageResources.noServices : InstalledPackageResources.formatServices(services.join(separator))));
  }

  private static nameOf(value: unknown): string {
    return typeof value === "object" && value !== null && "name" in value ? String(value.name) : String(value);
  }
}

try {
  await OpenModule.runAsync(process.argv[2]);
}
catch (error) {
  if (!(error instanceof InstalledPackageCheckFailedException))
    throw error;
  console.error(error.message);
  process.exitCode = InstalledPackageResources.failureExitCode;
}
