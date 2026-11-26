/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { ScriptException } from "../exceptions/script.exception.ts";
import { RepositoryModule } from "../models/repository-module.ts";
import { TestTimes } from "../models/test-times.ts";
import { Resources } from "../resources.ts";
import { PackageBinary } from "../services/package-binary.ts";
import { ProcessRunner } from "../services/process-runner.ts";

class TestTiming {
  private static readonly root: string = path.dirname(path.dirname(import.meta.dirname));

  private readonly runner: ProcessRunner = new ProcessRunner();
  private readonly times: Map<string, number[]> = new Map();

  public async runAsync(): Promise<number> {
    const folder = path.join(TestTiming.root, ...Resources.timingFolder);
    await rm(folder, { recursive: true, force: true });
    await mkdir(folder, { recursive: true });
    for (let run = 1; run <= Resources.timingRuns; run++) {
      const report = path.join(folder, Resources.formatTimingReport(Resources.rootSuiteName, run));
      const ran = await this.runner.runAsync(process.execPath, [...Resources.timingVitestRun, `${Resources.jsonOutputOption}${report}`], TestTiming.root);
      if (ran !== Resources.successExitCode)
        return ran;
      await this.readAsync(report);
      for (const module of RepositoryModule.all) {
        const directory = path.join(TestTiming.root, module.windowFolder);
        const windowReport = path.join(folder, Resources.formatTimingReport(path.basename(module.windowFolder), run));
        await rm(path.join(TestTiming.root, Resources.nodeModulesFolder, Resources.viteCacheFolder), { recursive: true, force: true });
        const angular = await PackageBinary.locateAsync(directory, Resources.angularCliPackage, Resources.angularCliCommand);
        const specs = await this.runner.runAsync(process.execPath, [angular, ...Resources.timingAngularTest, windowReport], directory);
        if (specs !== Resources.successExitCode)
          return specs;
        await this.readAsync(windowReport);
      }
    }
    return await this.judgeAsync();
  }

  private async readAsync(report: string): Promise<void> {
    for (const [file, milliseconds] of await TestTimes.readAsync(TestTiming.root, path.relative(TestTiming.root, report)))
      this.times.set(file, [...this.times.get(file) ?? [], milliseconds]);
  }

  private async judgeAsync(): Promise<number> {
    const listed = await TestTimes.readListedAsync(TestTiming.root);
    let over = 0;
    for (const [file, times] of [...this.times].sort(([left], [right]) => left < right ? -1 : Number(left > right))) {
      const median = TestTiming.median(times);
      const allowed = listed.get(file);
      const limit = allowed === undefined ? Resources.fileBudgetMilliseconds : allowed * (1 + Resources.timingMargin);
      const isOver = median > limit;
      over += Number(isOver);
      if (isOver || allowed !== undefined || median > Resources.fileBudgetMilliseconds)
        console.log(Resources.formatTimingMedian(file, median, limit, isOver));
    }
    for (const file of [...listed.keys()].filter(t => !this.times.has(t))) {
      console.log(Resources.formatListedFileMissing(file).trimEnd());
      over++;
    }
    console.log(Resources.formatTimingSummary(this.times.size, over));
    return over === 0 ? Resources.successExitCode : Resources.failureExitCode;
  }

  private static median(values: readonly number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[middle] ?? 0 : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }
}

try {
  process.exitCode = await new TestTiming().runAsync();
}
catch (error) {
  if (!(error instanceof ScriptException))
    throw error;
  console.error(error.message);
  process.exitCode = Resources.failureExitCode;
}
