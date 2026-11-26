/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class IgnoredPaths {
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.checkIgnoreArguments);
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private readonly runner: ProgramRunner;
  private readonly folders: Map<string, boolean> = new Map();

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async hasShownAsync(top: string, names: readonly string[], signal?: AbortSignal): Promise<boolean> {
    const paths = names.map(t => t.replaceAll("\\", "/")).filter(t => t.length > 0 && t !== Resources.dotGitName && !t.startsWith(`${Resources.dotGitName}/`));
    if (paths.some(t => t === Resources.ignoreFileName || t.endsWith(`/${Resources.ignoreFileName}`))) {
      this.forget();
      return true;
    }
    const open = paths.filter(t => !IgnoredPaths.foldersOf(t).some(u => this.isKnownIgnored(top, u)));
    if (open.length === 0)
      return false;
    const asked = [...new Set(open.flatMap(t => [...IgnoredPaths.foldersOf(t).filter(u => !this.folders.has(IgnoredPaths.keyOf(top, u))), t]))];
    const ignored = await this.checkAsync(top, asked, signal);
    this.remember(top, asked.filter(t => t.endsWith("/")), ignored);
    return open.some(t => !ignored.has(t) && !IgnoredPaths.foldersOf(t).some(u => this.isKnownIgnored(top, u) || ignored.has(u)));
  }

  public forget(): void {
    this.folders.clear();
  }

  public forgetIndex(top: string): void {
    const prefix = IgnoredPaths.keyOf(top, "");
    for (const key of [...this.folders.keys()].filter(t => t.startsWith(prefix)))
      this.folders.delete(key);
  }

  public async ignoredFoldersAsync(top: string, folders: readonly string[], signal?: AbortSignal): Promise<Set<string>> {
    const asked = [...new Set(folders.map(t => `${t}/`).filter(t => !this.folders.has(IgnoredPaths.keyOf(top, t))))];
    if (asked.length > 0)
      this.remember(top, asked, await this.checkAsync(top, asked, signal));
    return new Set(folders.filter(t => this.isKnownIgnored(top, `${t}/`)));
  }

  private isKnownIgnored(top: string, folder: string): boolean {
    return this.folders.get(IgnoredPaths.keyOf(top, folder)) === true;
  }

  private remember(top: string, folders: readonly string[], ignored: ReadonlySet<string>): void {
    if (this.folders.size + folders.length > Resources.ignoredFoldersLimit)
      this.folders.clear();
    for (const folder of folders)
      this.folders.set(IgnoredPaths.keyOf(top, folder), ignored.has(folder));
  }

  private static keyOf(top: string, folder: string): string {
    return `${top}${Resources.nulCharacter}${folder}`;
  }

  private static foldersOf(file: string): string[] {
    const parts = file.split("/");
    return parts.slice(0, -1).map((_, i) => `${parts.slice(0, i + 1).join("/")}/`);
  }

  private async checkAsync(top: string, paths: readonly string[], signal?: AbortSignal): Promise<Set<string>> {
    const input = Buffer.from(paths.map(t => t + Resources.nulCharacter).join(""), Resources.utf8Encoding);
    const result = await this.runner.runAsync(ProgramRun.readGit(IgnoredPaths.ARGUMENTS, top, IgnoredPaths.LIMITS, signal).withInput(input).unlogged());
    if (result.exit.code === 1)
      return new Set();
    if (result.exit.code !== 0 || result.isTruncated)
      throw new GitFailedException(Resources.checkIgnoreCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return new Set(result.output.toString(Resources.utf8Encoding).split(Resources.nulCharacter).filter(t => t.length > 0));
  }
}
