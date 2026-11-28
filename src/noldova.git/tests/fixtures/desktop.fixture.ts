/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";

import { DataDirectory, EventChannel, type IMethodHandler, ModuleDatabase, type OwnedProcess, OwnershipLock, PermissionCenter, ProcessRequest, ProcessSupervisor, ShellDatabase,
  ShellMigrations, ToolDescriptor, ToolRegistry } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import type { JsonValue } from "@noldova/git.protocol";

import { WorktreeTable } from "../../src/services/worktree-table.ts";

export class DesktopFixture {
  private static readonly MODULE: string = "git";
  private static readonly ISOLATION: Readonly<Record<string, string>> = { GIT_CONFIG_NOSYSTEM: "1" };
  private static readonly TOOLS: readonly string[] = DesktopFixture.readTools();
  private readonly folder: string;
  private readonly lock: OwnershipLock;
  private readonly shell: ShellDatabase;
  private readonly database: ModuleDatabase;
  private readonly processes: ProcessSupervisor;
  private readonly added: Readonly<Record<string, string>>;
  private readonly running: Set<Promise<void>> = new Set();
  private readonly publishing: Map<number, PromiseWithResolvers<void>> = new Map();
  private sessions: number = 0;
  private starts: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public readonly requests: ProcessRequest[] = [];
  public readonly events: string[] = [];
  public readonly diagnostics: string[] = [];
  public readonly published: [string, number | undefined, number | null | undefined, JsonValue][] = [];
  public readonly methods: Map<string, IMethodHandler> = new Map();
  public readonly services: Map<string, object> = new Map();
  public readonly permissions: PermissionCenter = new PermissionCenter("app");
  public readonly registry: ToolRegistry;
  public readonly workFolder: string;
  public readonly context: FakeRuntimePartContext;

  private constructor(
    folder: string,
    lock: OwnershipLock,
    shell: ShellDatabase,
    database: ModuleDatabase,
    environment: Readonly<Record<string, string>>,
    added: Readonly<Record<string, string>>) {
    this.folder = folder;
    this.lock = lock;
    this.shell = shell;
    this.database = database;
    this.added = added;
    this.workFolder = path.join(folder, "work", DesktopFixture.MODULE);
    this.registry = this.createRegistry();
    const diagnostics = new Writable({
      write: (chunk: unknown, _encoding, done): void => {
        this.diagnostics.push(String(chunk));
        done();
      }
    });
    this.processes = ProcessSupervisor.create(shell, process.platform, environment, diagnostics);
    this.context = this.createContextOn(this.registry);
    this.context.answer("registerMethod", (name, handler) => void this.methods.set(name, handler));
    this.context.answer("publishService", (name, service) => void this.services.set(name, service));
  }

  public static async createAsync(environment: Readonly<Record<string, string>>, added: Readonly<Record<string, string>> = {}): Promise<DesktopFixture> {
    const folder = await mkdtemp(path.join(tmpdir(), "git-desktop-"));
    const directory = new DataDirectory(folder);
    const lock = OwnershipLock.acquire(directory);
    const shell = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    const database = await ModuleDatabase.openAsync(directory, DesktopFixture.MODULE, [WorktreeTable.migration]);
    return new DesktopFixture(folder, lock, shell, database, environment, added);
  }

  public createContext(): FakeRuntimePartContext {
    return this.createContextOn(this.createRegistry());
  }

  public waitForStartAsync(): Promise<void> {
    return this.starts.promise;
  }

  public async publishedToAsync(window: number): Promise<void> {
    if (this.published.some(t => t[2] === window))
      return;
    const waiting = this.publishing.get(window) ?? Promise.withResolvers<void>();
    this.publishing.set(window, waiting);
    await waiting.promise;
  }

  public async settleAsync(): Promise<void> {
    await Promise.all(this.running);
  }

  public async disposeAsync(): Promise<void> {
    await this.settleAsync();
    await this.processes.stopAllAsync();
    this.database.close();
    this.shell.close();
    this.lock.release();
    await rm(this.folder, { recursive: true, force: true });
  }

  private createContextOn(registry: ToolRegistry): FakeRuntimePartContext {
    const context = new FakeRuntimePartContext();
    context.answer("moduleId", DesktopFixture.MODULE);
    context.answer("startProcessAsync", request => this.startAsync(request));
    context.answer("getWorkFolderAsync", async () => {
      await mkdir(this.workFolder, { recursive: true });
      return this.workFolder;
    });
    context.answer("declareEvent", name => new EventChannel((payload, connection, window) => this.publish(name, connection, window, payload), () => {}));
    context.database.answer("read", this.database.read.bind(this.database));
    context.database.answer("readAll", this.database.readAll.bind(this.database));
    context.database.answer("run", this.database.run.bind(this.database));
    context.database.answer("transaction", this.database.transaction.bind(this.database));
    context.tools.answer("register", (descriptor, handler) =>
      registry.register(DesktopFixture.MODULE, new ToolDescriptor(descriptor, DesktopFixture.TOOLS), handler, DesktopFixture.TOOLS, context.log));
    context.beStrict();
    context.allow("registerMethod", "publishService", "onClientClosed");
    context.log.allow("write");
    return context;
  }

  private async startAsync(request: ProcessRequest): Promise<OwnedProcess> {
    this.requests.push(request);
    const isolated = new ProcessRequest(request.program, request.arguments, request.workingFolder, { ...DesktopFixture.ISOLATION, ...this.added, ...request.environment },
      request.inherit, request.signal, request.isVerbatim);
    const owned = await this.processes.startAsync(DesktopFixture.MODULE, isolated);
    const label = request.arguments.join(" ");
    this.events.push(`start ${label}`);
    this.running.add(owned.exited.then(() => void this.events.push(`exit ${label}`)));
    this.starts.resolve();
    this.starts = Promise.withResolvers<void>();
    return owned;
  }

  private publish(name: string, connection: number | undefined, window: number | null | undefined, payload: JsonValue): void {
    this.published.push([name, connection, window, payload]);
    if (!Object.isNumber(window))
      return;
    this.publishing.get(window)?.resolve();
    this.publishing.delete(window);
  }

  private createRegistry(): ToolRegistry {
    return new ToolRegistry(() => `session-${String(++this.sessions)}`, undefined, this.permissions);
  }

  private static readTools(): readonly string[] {
    const declaration: unknown = JSON.parse(readFileSync(new URL("../../module.json", import.meta.url), "utf8"));
    const contributes: unknown = Object.isObject(declaration) && "contributes" in declaration ? declaration.contributes : null;
    const tools: unknown = Object.isObject(contributes) && "tools" in contributes ? contributes.tools : null;
    if (!Array.isArray(tools) || !tools.every(t => Object.isString(t)))
      throw new TypeError("module.json names no contributed tools.");
    return tools;
  }
}
