/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ScriptException } from "./exceptions/script.exception.ts";
import { RepositoryModule } from "./models/repository-module.ts";
import { Resources } from "./resources.ts";
import { PackageBinary } from "./services/package-binary.ts";
import { ProcessRunner } from "./services/process-runner.ts";

class Test {
  private static readonly root: string = path.dirname(import.meta.dirname);
  private static readonly typeScript: string = path.join(...Resources.typeScriptCompiler);
  private static readonly checks: readonly (readonly string[])[] = [
    [Resources.declarationCheckScript],
    [Resources.defaultChangeDetectionCheckScript],
    [Test.typeScript, Resources.projectOption, Resources.scriptsProject],
    ...[...RepositoryModule.shared.map(t => t.folder), ...RepositoryModule.all.flatMap(t => [t.protocolFolder, t.folder])]
      .map(t => [Test.typeScript, Resources.projectOption, path.posix.join(t, Resources.specProjectFile)])
  ];
  private static readonly noGates: readonly string[] = Resources.coverageGates.map(t => Resources.formatNoGate(t));
  private static readonly windowFolders: readonly string[] = RepositoryModule.all.map(t => `${t.windowFolder}${Resources.pathSeparator}`);
  private static readonly options: readonly string[] = [Resources.skipTestDetails, Resources.skipCoverageDetails];

  private readonly runner: ProcessRunner = new ProcessRunner();

  public async runAsync(values: readonly string[]): Promise<number> {
    const repeatAt: number = values.indexOf(Resources.repeatOption);
    const rest: readonly string[] = repeatAt === -1 ? values : [...values.slice(0, repeatAt), ...values.slice(repeatAt + 2)];
    if (rest.includes(Resources.repeatOption)) {
      console.error(Resources.repeatOnce);
      return Resources.failureExitCode;
    }
    const count: string = repeatAt === -1 ? String(Resources.defaultRepeat) : values[repeatAt + 1] ?? "";
    if (!Resources.wholeNumberPattern.test(count)) {
      console.error(Resources.repeatValue);
      return Resources.failureExitCode;
    }
    const repeat: number = Number(count);
    const shards: readonly string[] = rest.filter(t => t.startsWith(Resources.shardPrefix));
    if (shards.length > 1) {
      console.error(Resources.shardOnce);
      return Resources.failureExitCode;
    }
    const shard: RegExpExecArray | null = shards.length === 0 ? null : Resources.shardPattern.exec(shards[0] ?? "");
    const part: number = Number(shard?.[1] ?? 0);
    const parts: number = Number(shard?.[2] ?? 0);
    if (shards.length === 1 && (shard === null || part > parts)) {
      console.error(Resources.shardValue);
      return Resources.failureExitCode;
    }
    const tests: readonly string[] = rest.filter(t => !t.startsWith(Resources.shardPrefix));
    if (parts > 0 && tests.some(t => !t.startsWith(Resources.optionPrefix))) {
      console.error(Resources.shardFiltered);
      return Resources.failureExitCode;
    }
    const options: readonly string[] = tests.filter(t => t.startsWith(Resources.optionPrefix));
    const unknown: readonly string[] = options.filter(t => !Test.options.includes(t));
    if (unknown.length > 0) {
      console.error(Resources.formatUnknownTestOptions(Test.options, unknown));
      return Resources.failureExitCode;
    }
    const checked: number = part > 1 ? Resources.successExitCode : await this.runStepsAsync(Test.checks, Test.root);
    if (checked !== Resources.successExitCode)
      return checked;
    for (let run = 1; run <= repeat; run++) {
      if (repeat > 1)
        process.stdout.write(Resources.formatRunHeading(run, repeat));
      const ran: number = parts > 0 ? await this.runPartAsync(options, part, parts) : await this.runTestsAsync(tests, options);
      if (ran !== Resources.successExitCode) {
        if (repeat > 1)
          process.stdout.write(Resources.formatRepeatStopped(run, repeat));
        return ran;
      }
    }
    if (repeat > 1)
      process.stdout.write(Resources.formatAllRunsPassed(repeat));
    return Resources.successExitCode;
  }

  private static rootTests(options: readonly string[]): readonly string[] {
    return [
      ...Resources.vitestRun,
      options.includes(Resources.skipTestDetails) ? Resources.dotReporter : Resources.defaultReporter,
      Resources.stuckTestReporter,
      ...(options.includes(Resources.skipCoverageDetails) ? [Resources.skipFullCoverage] : [])
    ];
  }

  private async runPartAsync(options: readonly string[], part: number, parts: number): Promise<number> {
    const blobs: string = path.join(Test.root, Resources.blobFolder);
    rmSync(blobs, { recursive: true, force: true });
    mkdirSync(blobs, { recursive: true });
    writeFileSync(path.join(blobs, Resources.formatPartRootFile(part)), Test.root.replaceAll(Resources.windowsPathSeparator, Resources.pathSeparator));
    const root: readonly string[] = [
      ...Test.rootTests(options), ...Test.noGates, Resources.formatShardOption(part, parts), Resources.blobReporter, Resources.formatBlobOutput(part)
    ];
    const ran: number[] = [await this.runStepsAsync([root], Test.root)];
    for (const [index, folder] of Test.windowFolders.entries())
      if (parts - index % parts === part)
        ran.push(await this.runWindowAsync(folder, null));
    if (part === 1)
      ran.push(await this.runStepsAsync([[Resources.installedPackageScript]], Test.root));
    return ran.find(t => t !== Resources.successExitCode) ?? Resources.successExitCode;
  }

  private async runTestsAsync(values: readonly string[], options: readonly string[]): Promise<number> {
    const rootTests: readonly string[] = Test.rootTests(options);
    const filters: readonly string[] = values.filter(t => !t.startsWith(Resources.optionPrefix));
    const paths: readonly string[] = filters.map(t => t.replaceAll(Resources.windowsPathSeparator, Resources.pathSeparator));
    const rootFilters: readonly string[] = paths.filter(t => !Test.windowFolders.some(w => t.startsWith(w)));
    const windowSpecs: readonly string[] = paths.filter(t => Test.windowFolders.some(w => t.startsWith(w)));
    if (filters.length > 0 && windowSpecs.length === 0)
      return await this.runStepsAsync([[...rootTests, ...Test.noGates, ...rootFilters]], Test.root);
    if (filters.length === 0) {
      const timed: readonly string[] = [...rootTests, ...Resources.testTimesReporter];
      const ran: number[] = [await this.runStepsAsync([timed, [Resources.testTimeCheckScript]], Test.root)];
      for (const folder of Test.windowFolders)
        ran.push(await this.runWindowAsync(folder, null));
      ran.push(await this.runStepsAsync([[Resources.installedPackageScript]], Test.root));
      return ran.find(t => t !== Resources.successExitCode) ?? Resources.successExitCode;
    }
    const rootSteps: (readonly string[])[] = rootFilters.length === 0 ? [] : [[...rootTests, ...Test.noGates, ...rootFilters]];
    const ran: number = await this.runStepsAsync(rootSteps, Test.root);
    if (ran !== Resources.successExitCode)
      return ran;
    for (const folder of Test.windowFolders) {
      const specs: readonly string[] = windowSpecs.filter(t => t.startsWith(folder)).map(t => t.slice(folder.length));
      const windowRan: number = specs.length === 0 ? Resources.successExitCode : await this.runWindowAsync(folder, specs);
      if (windowRan !== Resources.successExitCode)
        return windowRan;
    }
    return Resources.successExitCode;
  }

  private async runWindowAsync(folder: string, specs: readonly string[] | null): Promise<number> {
    const directory: string = path.join(Test.root, folder);
    rmSync(path.join(Test.root, Resources.nodeModulesFolder, Resources.viteCacheFolder), { recursive: true, force: true });
    const compiler: string = await PackageBinary.locateAsync(directory, Resources.angularCompilerPackage, Resources.angularCompilerCommand);
    const browsers: string = await PackageBinary.locateAsync(directory, Resources.playwrightPackage, Resources.playwrightCommand);
    const angular: string = await PackageBinary.locateAsync(directory, Resources.angularCliPackage, Resources.angularCliCommand);
    const prepared: number = await this.runStepsAsync([[compiler, Resources.projectOption, Resources.projectFile]], directory)
      || await this.runStepsAsync([[browsers, ...Resources.browserInstallArguments]], directory, Resources.browserInstallTimeoutMilliseconds);
    if (prepared !== Resources.successExitCode)
      return prepared;
    const steps: (readonly string[])[] = specs === null
      ? [[angular, Resources.angularTestCommand]]
      : [[angular, Resources.angularTestCommand, Resources.noCoverage, ...Test.include(specs)]];
    return await this.runStepsAsync(steps, directory);
  }

  private static include(specs: readonly string[]): readonly string[] {
    return specs.flatMap(t => [Resources.includeOption, t]);
  }

  private async runStepsAsync(steps: readonly (readonly string[])[], folder: string, timeout?: number): Promise<number> {
    for (const step of steps) {
      const status: number = await this.runner.runAsync(process.execPath, step, folder, timeout);
      if (status !== Resources.successExitCode)
        return status;
    }
    return Resources.successExitCode;
  }
}

try {
  process.exitCode = await new Test().runAsync(process.argv.slice(2));
}
catch (error) {
  if (!(error instanceof ScriptException))
    throw error;
  console.error(error.message);
  process.exitCode = Resources.failureExitCode;
}
