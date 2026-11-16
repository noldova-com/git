/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, statSync } from "node:fs";
import path from "node:path";

import { AngularPackageBuilder } from "./angular/angular-package-builder.ts";
import { PackageCopyCheck } from "./checks/package-copy-check.ts";
import { PackageException } from "./exceptions/package.exception.ts";
import { ProcessException } from "./exceptions/process.exception.ts";
import { SingleCopyPackage } from "./models/single-copy-package.ts";
import { Resources } from "./resources.ts";
import { NpmCommand } from "./services/npm-command.ts";
import { PackageInstall } from "./services/package-install.ts";
import { PackagePacker } from "./services/package-packer.ts";
import { ProcessRunner } from "./services/process-runner.ts";

class Build {
  private static readonly root: string = path.dirname(import.meta.dirname);

  private readonly runner: ProcessRunner = new ProcessRunner();
  private readonly npm: NpmCommand = new NpmCommand(this.runner, process.env);
  private readonly packer: PackagePacker = new PackagePacker(Build.root, this.npm, this.runner, new AngularPackageBuilder(this.runner),
    new PackageInstall(Build.root, this.npm), t => Build.report(t));

  public async runAsync(options: readonly string[]): Promise<number> {
    return options.includes(Resources.listCopiesOption) ? await this.listCopiesAsync(options) : await this.buildAsync();
  }

  private static report(line: string): void {
    console.error(line);
  }

  private static isInstalled(): boolean {
    const installed = path.join(Build.root, ...Resources.installedLockSegments);
    if (!existsSync(installed))
      return false;
    if (statSync(installed).mtimeMs >= statSync(path.join(Build.root, Resources.lockFile)).mtimeMs)
      return true;
    Build.report(Resources.lockFileChanged);
    return false;
  }

  private async hasOneCopyEachAsync(): Promise<boolean> {
    try {
      for (const single of SingleCopyPackage.all)
        if (!await new PackageCopyCheck(Build.root, this.npm, single, Resources.repositoryPlace).runAsync(process.stderr))
          return false;
      return true;
    }
    catch (error) {
      if (!(error instanceof ProcessException))
        throw error;
      Build.report(error.message);
      return false;
    }
  }

  private async listCopiesAsync(options: readonly string[]): Promise<number> {
    if (options.length !== 1) {
      Build.report(Resources.listCopiesAlone);
      return Resources.failureExitCode;
    }
    try {
      for (const [source, name, entry] of await this.packer.listCopiesAsync())
        process.stdout.write(Resources.formatCopyLine(source, name, entry));
    }
    catch (error) {
      if (!(error instanceof PackageException))
        throw error;
      Build.report(error.message);
      return Resources.failureExitCode;
    }
    process.stdout.write(Resources.copiesEnd);
    return Resources.successExitCode;
  }

  private async installAsync(): Promise<number> {
    if (Build.isInstalled())
      return Resources.successExitCode;
    const npmPath = process.env[Resources.npmPathVariable];
    if (npmPath === undefined || npmPath.length === 0) {
      Build.report(Resources.buildNeedsNpm);
      return Resources.failureExitCode;
    }
    Build.report(Resources.installing);
    try {
      return await this.runner.runAsync(process.execPath, [npmPath, ...Resources.cleanInstallArguments], Build.root, Resources.installTimeoutMilliseconds);
    }
    catch (error) {
      if (!(error instanceof ProcessException))
        throw error;
      Build.report(error.message);
      return Resources.failureExitCode;
    }
  }

  private async buildAsync(): Promise<number> {
    const installed = await this.installAsync();
    if (installed !== Resources.successExitCode)
      return installed;
    if (!await this.hasOneCopyEachAsync())
      return Resources.failureExitCode;
    return await this.packer.runAsync();
  }
}

process.exitCode = await new Build().runAsync(process.argv.slice(2));
