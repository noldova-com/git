/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import { type IPermissionDetail, type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { ConflictKind, ConflictResolution, GitNames, type GitStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { ConflictGoneException } from "../exceptions/conflict-gone.exception.ts";
import { FileOutsideRepositoryException } from "../exceptions/file-outside-repository.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { ResolutionMarkersLeftException } from "../exceptions/resolution-markers-left.exception.ts";
import { ResolutionNotOfferedException } from "../exceptions/resolution-not-offered.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { ConflictMarkers } from "../models/conflict-markers.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { FilterOptionsReader } from "./filter-options.reader.ts";
import type { HooksReader } from "./hooks.reader.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

/**
 * Resolves one conflicted file and stages it: writes the resolved text, takes one side's whole file, or deletes the file.
 * It refuses a choice the file's conflict kind doesn't offer, a text that still has marker lines, and a file that is no longer unmerged.
 */
export class ResolveConflictWriter implements IGitWrite {
  public readonly method: string = GitNames.resolveConflictMethod;
  /** Not undone from the journal: the resolved text replaced the worktree file, which an index tree doesn't hold. */
  public readonly undo: UndoMode = UndoMode.None;
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.indexWriteMilliseconds);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.Deny];

  private readonly runner: ProgramRunner;
  private readonly hooks: HooksReader;
  private readonly filters: FilterOptionsReader;
  private readonly file: string;
  private readonly resolution: ConflictResolution;
  private readonly text: string | null;

  public constructor(runner: ProgramRunner, hooks: HooksReader, filters: FilterOptionsReader, file: string, resolution: ConflictResolution, text: string | null) {
    this.runner = runner;
    this.hooks = hooks;
    this.filters = filters;
    this.file = file;
    this.resolution = resolution;
    this.text = text;
  }

  public refuse(status: GitStatus): void {
    const kind = status.entries.find(t => t.path === this.file)?.conflict ?? null;
    if (kind === null)
      throw new ConflictGoneException();
    if (!Resources.offeredResolutions[kind].includes(this.resolution))
      throw new ResolutionNotOfferedException();
    if (this.text !== null && ConflictMarkers.has(this.text))
      throw new ResolutionMarkersLeftException();
  }

  public async requestAsync(folders: RepositoryFolders, status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const hooks = await this.hooks.readAsync(folders.top, Resources.indexHooks, signal);
    const filters = await this.filters.namesAsync(folders.top, Resources.stageFilterKinds, signal);
    const kind = status.entries.find(t => t.path === this.file)?.conflict ?? null;
    const wholeFile = kind === ConflictKind.BothModified && (this.resolution === ConflictResolution.Ours || this.resolution === ConflictResolution.Theirs);
    const details: IPermissionDetail[] = [
      { label: Resources.filesLabel, kind: PermissionDetailKind.Code, value: LogReader.withoutControls(this.file) },
      ...wholeFile ? [{ label: Resources.wholeFileLabel, kind: PermissionDetailKind.Text, value: Resources.wholeFileNote }] : [],
      WritePermission.hooksDetail(hooks),
      ...filters.length === 0 ? [] : [WritePermission.filtersDetail(filters.map(t => LogReader.withoutControls(t)))]
    ];
    return WritePermission.create(
      GitNames.resolveConflictMethod,
      folders.top,
      Resources.formatResolveTitle(LogReader.withoutControls(this.file), Resources.resolutionNames[this.resolution]),
      details,
      ToolRisk.Medium,
      ResolveConflictWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    switch (this.resolution) {
      case ConflictResolution.Text:
        await this.writeTextAsync(folders.top);
        break;
      case ConflictResolution.Ours:
      case ConflictResolution.Theirs:
        await this.runGitAsync(folders, this.resolution === ConflictResolution.Ours ? Resources.checkoutOursArguments : Resources.checkoutTheirsArguments,
          Resources.checkoutCommand, signal);
        break;
      case ConflictResolution.Delete:
        await this.runGitAsync(folders, Resources.resolveRemoveArguments, Resources.removeCommand, signal);
        return;
    }
    await this.runGitAsync(folders, Resources.resolveAddArguments, Resources.addCommand, signal);
  }

  /** Writes the text over the worktree file, once its folder is known to be inside the repository even through links. */
  private async writeTextAsync(top: string): Promise<void> {
    const target = path.join(top, this.file);
    const [folder, root] = await Promise.all([realpath(path.dirname(target)), realpath(top)]);
    const relative = path.relative(root, folder);
    if (relative.split(path.sep)[0] === Resources.parentFolder || path.isAbsolute(relative))
      throw new FileOutsideRepositoryException();
    await writeFile(path.join(folder, path.basename(target)), this.text ?? "", Resources.utf8Encoding);
  }

  private async runGitAsync(folders: RepositoryFolders, options: readonly string[], command: string, signal?: AbortSignal): Promise<void> {
    const run = ProgramRun.writeGit(new GitArguments(options).withPaths([this.file]), folders.top, folders.gitFolder, folders.commonGitFolder,
      ResolveConflictWriter.LIMITS, signal);
    const result = await this.runner.runAsync(run);
    if (result.exit.code !== 0)
      throw new GitFailedException(command, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }
}
