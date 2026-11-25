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

/**
 * Tells whether a worktree's changed files include one git doesn't ignore, so a build writing its output or a tool writing its cache costs one
 * `git check-ignore` rather than a status read each time. It remembers which folders git ignores and which it doesn't until an ignore file changes,
 * since nothing under an ignored folder can be shown; a file's own answer isn't remembered, as a rule can ignore one file in a folder and not another.
 */
export class IgnoredPaths {
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.checkIgnoreArguments);
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private readonly runner: ProgramRunner;
  private readonly folders: Map<string, boolean> = new Map();

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  /**
   * Whether any of the changed paths, relative to the worktree's top with either separator, is one git doesn't ignore. Paths in the git folder count
   * as unchanged, since the git folder has watches of its own; a changed ignore file counts as a change and makes it forget every folder's answer.
   * A path named without a trailing slash still matches a rule for folders while it is one, as git looks at the path itself, so a watch naming the folder
   * a file changed in finds it ignored; a tracked file counts as shown, as in git's status.
   */
  public async hasShownAsync(top: string, names: readonly string[], signal?: AbortSignal): Promise<boolean> {
    const paths = names.map(t => t.replaceAll("\\", "/")).filter(t => t.length > 0 && t !== Resources.dotGitName && !t.startsWith(`${Resources.dotGitName}/`));
    if (paths.some(t => t === Resources.ignoreFileName || t.endsWith(`/${Resources.ignoreFileName}`))) {
      this.forget();
      return true;
    }
    const open = paths.filter(t => !IgnoredPaths.foldersOf(t).some(u => this.folders.get(u) === true));
    if (open.length === 0)
      return false;
    const asked = [...new Set(open.flatMap(t => [...IgnoredPaths.foldersOf(t).filter(u => !this.folders.has(u)), t]))];
    const ignored = await this.checkAsync(top, asked, signal);
    if (this.folders.size + asked.length > Resources.ignoredFoldersLimit)
      this.folders.clear();
    for (const folder of asked.filter(t => t.endsWith("/")))
      this.folders.set(folder, ignored.has(folder));
    return open.some(t => !ignored.has(t) && !IgnoredPaths.foldersOf(t).some(u => this.folders.get(u) === true || ignored.has(u)));
  }

  /** Forgets every folder's answer, as a changed ignore file can change them. */
  public forget(): void {
    this.folders.clear();
  }

  /** Which of the folders, relative to the top with `/` and no trailing slash, git ignores; it remembers each answer, as it does for a changed file's folders. */
  public async ignoredFoldersAsync(top: string, folders: readonly string[], signal?: AbortSignal): Promise<Set<string>> {
    const asked = [...new Set(folders.map(t => `${t}/`).filter(t => !this.folders.has(t)))];
    if (asked.length > 0) {
      const ignored = await this.checkAsync(top, asked, signal);
      if (this.folders.size + asked.length > Resources.ignoredFoldersLimit)
        this.folders.clear();
      for (const folder of asked)
        this.folders.set(folder, ignored.has(folder));
    }
    return new Set(folders.filter(t => this.folders.get(`${t}/`) === true));
  }

  /** The folders a path is in, outermost first, each with a trailing slash, as `git check-ignore` takes a folder. */
  private static foldersOf(file: string): string[] {
    const parts = file.split("/");
    return parts.slice(0, -1).map((_, i) => `${parts.slice(0, i + 1).join("/")}/`);
  }

  /** The asked paths git ignores; git answers 1 when it ignores none of them. */
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
