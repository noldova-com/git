/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { lstat } from "node:fs/promises";
import path from "node:path";

import { UntrustedSource } from "@noldova/git.protocol";

import { FilterNotSwitchableException } from "../exceptions/filter-not-switchable.exception.ts";
import { FilterSubmodulesTooManyException } from "../exceptions/filter-submodules-too-many.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class FilterOptionsReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.configOutputBytes, Resources.gitReadMilliseconds);
  private static readonly INDEX_LIMITS: ProgramLimits = new ProgramLimits(Resources.indexOutputBytes, Resources.gitReadMilliseconds);
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.filterNamesArguments);
  private static readonly INDEX: GitArguments = new GitArguments(Resources.stageIndexArguments);
  private static readonly RECURSE: GitArguments = new GitArguments(Resources.submoduleRecurseArguments);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, signal?: AbortSignal): Promise<readonly string[]> {
    const names = await this.walkAsync(top, Resources.stageFilterKinds, signal);
    if (names.some(t => t.includes(Resources.assignment)))
      throw new FilterNotSwitchableException();
    return names.flatMap(name => Resources.formatFilterOverrides(name));
  }

  public async checkoutRepositoriesAsync(top: string, signal?: AbortSignal): Promise<string[]> {
    const result = await this.runner.runAsync(ProgramRun.readGit(FilterOptionsReader.RECURSE, top, FilterOptionsReader.LIMITS, signal));
    if ((result.exit.code !== 0 && result.exit.code !== Resources.configNotFoundExitCode) || result.isTruncated)
      throw FilterOptionsReader.failed(Resources.configCommand, result.errors);
    return result.output.toString(Resources.utf8Encoding).trim() === Resources.configTrue ? await this.repositoriesAsync(top, signal) : [top];
  }

  public async namesAsync(folder: string, kinds: readonly string[], signal?: AbortSignal): Promise<string[]> {
    const result = await this.runner.runAsync(ProgramRun.readGit(FilterOptionsReader.ARGUMENTS, folder, FilterOptionsReader.LIMITS, signal));
    if (result.exit.code === Resources.configNotFoundExitCode)
      return [];
    if (result.exit.code !== 0 || result.isTruncated)
      throw FilterOptionsReader.failed(Resources.configCommand, result.errors);
    const names = new Set<string>();
    for (const line of result.output.toString(Resources.utf8Encoding).split(Resources.lineEnd)) {
      const tab = line.indexOf(Resources.tab);
      const key = line.slice(tab + 1);
      const end = key.lastIndexOf(Resources.keySeparator);
      if (Resources.repositoryConfigScopes.has(line.slice(0, tab)) && kinds.includes(key.slice(end + 1)))
        names.add(key.slice(Resources.filterPrefix.length, end));
    }
    return [...names];
  }

  private async walkAsync(top: string, kinds: readonly string[], signal?: AbortSignal): Promise<string[]> {
    const names = new Set<string>();
    for (const folder of await this.repositoriesAsync(top, signal))
      for (const name of await this.namesAsync(folder, kinds, signal))
        names.add(name);
    return [...names];
  }

  private async repositoriesAsync(top: string, signal?: AbortSignal): Promise<string[]> {
    const folders = [top];
    for (const folder of folders) {
      if (await FilterOptionsReader.isCheckedOutAsync(folder))
        folders.push(...await this.submodulesAsync(folder, signal));
      if (folders.length - 1 > Resources.filterSubmodulesLimit)
        throw new FilterSubmodulesTooManyException(Resources.filterSubmodulesLimit);
    }
    return folders;
  }

  private async submodulesAsync(folder: string, signal?: AbortSignal): Promise<string[]> {
    const result = await this.runner.runAsync(ProgramRun.readGit(FilterOptionsReader.INDEX, folder, FilterOptionsReader.INDEX_LIMITS, signal));
    if (result.exit.code !== 0 || result.isTruncated)
      throw FilterOptionsReader.failed(Resources.lsFilesCommand, result.errors);
    const paths = new Set<string>();
    for (const record of result.output.toString(Resources.utf8Encoding).split(Resources.recordSeparator))
      if (record.startsWith(Resources.gitlinkPrefix))
        paths.add(path.join(folder, record.slice(record.indexOf(Resources.tab) + 1)));
    const found = await Promise.all([...paths].map(async t => await FilterOptionsReader.isCheckedOutAsync(t) ? t : null));
    return found.filter(t => t !== null);
  }

  private static async isCheckedOutAsync(folder: string): Promise<boolean> {
    try {
      await lstat(path.join(folder, Resources.gitEntry));
      return true;
    } catch (error) {
      if (FilePresence.isGone(error))
        return false;
      throw error;
    }
  }

  private static failed(command: string, errors: Buffer): GitFailedException {
    return new GitFailedException(command, { text: errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }
}
