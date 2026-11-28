/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ReportedHookContext, Reporter, TestCase, TestModule, TestSuite, Vitest } from "vitest/node";

import { Resources } from "../resources.ts";
import { HeardModule } from "./heard-module.ts";

export default class StuckTestReporter implements Reporter {
  private readonly modules: Map<string, HeardModule> = new Map();
  private vitest: Vitest | null = null;
  private timer: NodeJS.Timeout | null = null;

  public onInit(vitest: Vitest): void {
    this.vitest = vitest;
    this.timer = setInterval(() => this.check(), Resources.stuckCheckMilliseconds);
    this.timer.unref();
  }

  public onTestModuleCollected(testModule: TestModule): void {
    this.modules.set(testModule.id, new HeardModule(testModule, performance.now()));
  }

  public onTestModuleEnd(testModule: TestModule): void {
    this.modules.delete(testModule.id);
  }

  public onTestSuiteReady(testSuite: TestSuite): void {
    this.hear(testSuite.module);
  }

  public onTestSuiteResult(testSuite: TestSuite): void {
    this.hear(testSuite.module);
  }

  public onTestCaseReady(testCase: TestCase): void {
    this.hear(testCase.module);
  }

  public onTestCaseResult(testCase: TestCase): void {
    this.hear(testCase.module);
  }

  public onHookStart(hook: ReportedHookContext): void {
    this.hear(StuckTestReporter.moduleOf(hook.entity));
  }

  public onHookEnd(hook: ReportedHookContext): void {
    this.hear(StuckTestReporter.moduleOf(hook.entity));
  }

  public onTestRunEnd(): void {
    this.stop();
    this.modules.clear();
  }

  private static moduleOf(entity: TestCase | TestSuite | TestModule): TestModule {
    return entity.type === Resources.moduleEntityType ? entity : entity.module;
  }

  private static nextTest(testModule: TestModule): TestCase | undefined {
    return [...testModule.children.allTests(Resources.pendingTestState)].find(t => Resources.runModes.includes(t.options.mode));
  }

  private static isQuiet(module: HeardModule, now: number): boolean {
    const testLimit: number = StuckTestReporter.nextTest(module.module)?.options.timeout ?? module.module.project.config.testTimeout;
    const hookLimit: number = module.module.project.config.hookTimeout;
    return now - module.heard > Math.max(testLimit, hookLimit) + Resources.stuckMarginMilliseconds;
  }

  private static nameOf(testModule: TestModule): string {
    const next: TestCase | undefined = StuckTestReporter.nextTest(testModule);
    return next === undefined ? testModule.relativeModuleId : Resources.formatStuckTest(testModule.relativeModuleId, next.fullName);
  }

  private hear(testModule: TestModule): void {
    const module: HeardModule | undefined = this.modules.get(testModule.id);
    if (module !== undefined)
      module.heard = performance.now();
  }

  private check(): void {
    const now: number = performance.now();
    const stuck: readonly string[] = [...this.modules.values()].filter(t => StuckTestReporter.isQuiet(t, now)).map(t => StuckTestReporter.nameOf(t.module));
    if (stuck.length === 0 || this.vitest === null)
      return;
    this.stop();
    console.error(Resources.formatStuckTests(stuck, Resources.stuckMarginMilliseconds));
    process.exitCode = Resources.failureExitCode;
    void this.vitest.exit(true);
  }

  private stop(): void {
    if (this.timer !== null)
      clearInterval(this.timer);
    this.timer = null;
  }
}
