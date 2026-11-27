/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { NpmUnavailableException } from "./exceptions/npm-unavailable.exception.ts";
import { ScriptException } from "./exceptions/script.exception.ts";
import { Resources } from "./resources.ts";
import { ProcessRunner } from "./services/process-runner.ts";

class TestMerge {
  private static readonly root: string = path.dirname(import.meta.dirname);

  private readonly runner: ProcessRunner = new ProcessRunner();

  public async runAsync(values: readonly string[]): Promise<number> {
    const [folder, count] = values;
    if (values.length !== 2 || folder === undefined || count === undefined || !Resources.wholeNumberPattern.test(count)) {
      console.error(Resources.mergeUsage);
      return Resources.failureExitCode;
    }
    const parts: number = Number(count);
    const merge: string = path.join(TestMerge.root, Resources.mergeFolder);
    await rm(merge, { recursive: true, force: true });
    await mkdir(merge, { recursive: true });
    const found: number[] = await this.collectAsync(path.resolve(folder), merge);
    if (found.length !== parts || found.some((t, i) => t !== i + 1)) {
      console.error(Resources.formatPartsMissing(folder, parts, found));
      return Resources.failureExitCode;
    }
    const installed: number = existsSync(path.join(TestMerge.root, Resources.vitestScript)) ? Resources.successExitCode : await this.installAsync();
    if (installed !== Resources.successExitCode)
      return installed;
    const merged: number = await this.runner.runAsync(process.execPath,
      [Resources.vitestScript, `${Resources.mergeReportsOption}${Resources.mergeFolder}`, ...Resources.mergeReporters], TestMerge.root);
    if (merged !== Resources.successExitCode)
      return merged;
    return await this.runner.runAsync(process.execPath, [Resources.testTimeCheckScript], TestMerge.root);
  }

  private async collectAsync(folder: string, merge: string): Promise<number[]> {
    const target: string = TestMerge.root.replaceAll(Resources.windowsPathSeparator, Resources.pathSeparator);
    const found: number[] = [];
    for (const entry of await readdir(folder, { withFileTypes: true, recursive: true })) {
      const blob: RegExpExecArray | null = entry.isFile() ? Resources.blobFilePattern.exec(entry.name) : null;
      if (blob === null)
        continue;
      const part: string = blob[1] ?? "";
      const rootFile: string = path.join(entry.parentPath, Resources.formatPartRootFile(Number(part)));
      if (!existsSync(rootFile))
        continue;
      const source: string = (await readFile(rootFile, Resources.encoding)).trim();
      const text: string = await readFile(path.join(entry.parentPath, entry.name), Resources.encoding);
      await writeFile(path.join(merge, entry.name), TestMerge.moved(text, source, target));
      found.push(Number(part));
    }
    return found.sort((a, b) => a - b);
  }

  private static moved(text: string, source: string, target: string): string {
    return text.replaceAll(TestMerge.fileUrl(source), TestMerge.fileUrl(target))
      .replaceAll(source, target)
      .replaceAll(source.replaceAll(Resources.pathSeparator, Resources.escapedWindowsPathSeparator), target);
  }

  private static fileUrl(root: string): string {
    return `${Resources.fileUrlPrefix}${root.startsWith(Resources.pathSeparator) ? "" : Resources.pathSeparator}${root}`;
  }

  private async installAsync(): Promise<number> {
    const npm: string | undefined = process.env[Resources.npmPathVariable];
    if (npm === undefined || npm.length === 0)
      throw new NpmUnavailableException();
    return await this.runner.runAsync(process.execPath, [npm, ...Resources.mergeInstall], TestMerge.root);
  }
}

try {
  process.exitCode = await new TestMerge().runAsync(process.argv.slice(2));
}
catch (error) {
  if (!(error instanceof ScriptException))
    throw error;
  console.error(error.message);
  process.exitCode = Resources.failureExitCode;
}
