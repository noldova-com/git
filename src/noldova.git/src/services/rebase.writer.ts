/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FileState, GitNames, type GitStatus, RebaseAction, type RebaseStep, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { PickDuringOperationException } from "../exceptions/pick-during-operation.exception.ts";
import { RebasePlanMovedException } from "../exceptions/rebase-plan-moved.exception.ts";
import { RebaseChangesInTheWayException } from "../exceptions/rebase-changes-in-the-way.exception.ts";
import { RebaseStoppedException } from "../exceptions/rebase-stopped.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { ProgramResult } from "../models/program-result.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { TodoGroup } from "../models/todo-group.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { HooksReader } from "./hooks.reader.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class RebaseWriter implements IGitWrite {
  public readonly method: string = GitNames.rebaseMethod;
  public readonly undo: UndoMode = UndoMode.Keep;
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.longWriteMilliseconds);
  private static readonly READ_LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.Deny];
  private static readonly UNCHANGED: ReadonlySet<FileState> = new Set([FileState.Unmodified, FileState.Untracked, FileState.Ignored]);
  private readonly runner: ProgramRunner;
  private readonly hooks: HooksReader;
  private readonly onto: string;
  private readonly steps: readonly RebaseStep[];
  private readonly updateRefs: boolean;

  public constructor(runner: ProgramRunner, hooks: HooksReader, onto: string, steps: readonly RebaseStep[], updateRefs: boolean) {
    this.runner = runner;
    this.hooks = hooks;
    this.onto = onto;
    this.steps = steps;
    this.updateRefs = updateRefs;
  }

  public refuse(status: GitStatus): void {
    if (status.entries.some(t => !Object.isNull(t.conflict)) || !Object.isNull(status.operation))
      throw new PickDuringOperationException();
    const changed = status.entries.filter(t => !RebaseWriter.UNCHANGED.has(t.index) || !RebaseWriter.UNCHANGED.has(t.worktree)).map(t => t.path);
    if (changed.length > 0)
      throw new RebaseChangesInTheWayException(changed);
  }

  public async requestAsync(folders: RepositoryFolders, status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const subjects = await this.readSubjectsAsync(folders.top, signal);
    const hooks = await this.hooks.readAsync(folders.top, Resources.rebaseHooks, signal);
    const kept = this.steps.filter(t => t.action !== RebaseAction.Drop).length;
    return WritePermission.create(
      this.method,
      folders.top,
      Resources.formatRebaseTitle(kept, status.branch, this.onto.slice(0, Resources.shortIdLength)),
      [
        {
          label: Resources.rebaseStepsLabel,
          kind: PermissionDetailKind.Code,
          value: this.steps.map(t => Resources.formatRebaseStepLine(t.action, t.id.slice(0, Resources.shortIdLength), LogReader.toLine((t.message ?? subjects.get(t.id) ?? "").split(Resources.lineEnd, 1).join(""))))
            .join(Resources.lineEnd)
        },
        WritePermission.hooksDetail(hooks)
      ],
      ToolRisk.Medium,
      RebaseWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, status: GitStatus, signal?: AbortSignal): Promise<void> {
    await this.requireRangeAsync(folders.top, signal);
    const todo = await this.todoAsync(folders, status.branch, signal);
    const options = [...Resources.rebaseArguments, ...this.updateRefs ? [Resources.rebaseUpdateRefsOption] : []];
    const gitArguments = new GitArguments(options, [this.onto]).withSettings([...Resources.sequenceEditorSettings, ...Resources.acceptEditorSettings]);
    const run = ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, RebaseWriter.LIMITS, signal);
    const result = await this.runner.runAsync(run.withInput(Buffer.from(todo, Resources.utf8Encoding)));
    if (result.exit.code === 0)
      return;
    const output = { text: `${result.output.toString(Resources.utf8Encoding)}${result.errors.toString(Resources.utf8Encoding)}`, source: UntrustedSource.Repository };
    if (Resources.pickConflictPattern.test(output.text))
      throw new RebaseStoppedException(output);
    const abort = new GitArguments([Resources.rebaseCommand, Resources.abortOption]);
    await this.runner.runAsync(ProgramRun.writeGit(abort, folders.top, folders.gitFolder, folders.commonGitFolder, RebaseWriter.LIMITS, signal));
    throw new GitFailedException(Resources.rebaseCommand, output);
  }

  private async requireRangeAsync(top: string, signal?: AbortSignal): Promise<void> {
    const gitArguments = new GitArguments(Resources.rebaseRangeArguments, [Resources.formatSymmetricRange(this.onto, Resources.headRevision)]);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, RebaseWriter.READ_LIMITS, signal));
    RebaseWriter.requireSuccess(Resources.revListCommand, result);
    const range = result.output.toString(Resources.utf8Encoding).split(Resources.lineEnd).filter(t => t.length > 0).toSorted();
    const steps = this.steps.map(t => t.id).toSorted();
    if (range.length !== steps.length || range.some((id, index) => id !== steps[index]))
      throw new RebasePlanMovedException();
  }

  private async todoAsync(folders: RepositoryFolders, branch: string | null, signal?: AbortSignal): Promise<string> {
    const stacked = this.updateRefs ? await this.readStackedAsync(folders.top, branch, signal) : new Map<string, string[]>();
    const lines: string[] = [];
    let group: TodoGroup | null = null;
    const close = async (): Promise<void> => {
      if (Object.isNull(group))
        return;
      if (!Object.isNull(group.message))
        lines.push(Resources.formatTodoLine(Resources.fixupMessageCommand, await this.commitMessageAsync(folders, group.last, group.message, signal)));
      lines.push(...group.ids.flatMap(t => stacked.get(t) ?? []).map(t => Resources.formatTodoLine(Resources.updateRefCommand, t)));
      group = null;
    };
    for (const step of this.steps) {
      if (step.action === RebaseAction.Drop) {
        lines.push(Resources.formatTodoLine(Resources.dropCommand, step.id), ...(stacked.get(step.id) ?? []).map(t => Resources.formatTodoLine(Resources.updateRefCommand, t)));
        continue;
      }
      if (!Object.isNull(group) && (step.action === RebaseAction.Squash || step.action === RebaseAction.Fixup)) {
        lines.push(Resources.formatTodoLine(Resources.fixupCommand, step.id));
        group.fold(step.id, step.message);
        continue;
      }
      await close();
      lines.push(Resources.formatTodoLine(step.action === RebaseAction.Edit ? Resources.editCommand : Resources.pickCommand, step.id));
      group = new TodoGroup(step.id, step.message);
    }
    await close();
    return `${lines.join(Resources.lineEnd)}${Resources.lineEnd}`;
  }

  private async commitMessageAsync(folders: RepositoryFolders, id: string, message: string, signal?: AbortSignal): Promise<string> {
    const gitArguments = new GitArguments([...Resources.commitTreeArguments, id, Resources.formatTreeRevision(id)]);
    const run = ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, RebaseWriter.LIMITS, signal);
    const result = await this.runner.runAsync(run.withInput(Buffer.from(message, Resources.utf8Encoding)));
    RebaseWriter.requireSuccess(Resources.commitTreeCommand, result);
    return result.output.toString(Resources.utf8Encoding).trim();
  }

  private async readStackedAsync(top: string, branch: string | null, signal?: AbortSignal): Promise<Map<string, string[]>> {
    const result = await this.runner.runAsync(ProgramRun.readGit(new GitArguments(Resources.branchRefTipsArguments), top, RebaseWriter.READ_LIMITS, signal));
    RebaseWriter.requireSuccess(Resources.forEachRefCommand, result);
    const current = Object.isNull(branch) ? null : Resources.formatBranchRef(branch);
    const stacked = new Map<string, string[]>();
    for (const line of result.output.toString(Resources.utf8Encoding).split(Resources.lineEnd)) {
      const [id = "", name = ""] = line.split(Resources.space);
      if (name.length > 0 && name !== current)
        stacked.set(id, [...stacked.get(id) ?? [], name]);
    }
    return stacked;
  }

  private async readSubjectsAsync(top: string, signal?: AbortSignal): Promise<Map<string, string>> {
    const gitArguments = new GitArguments(Resources.rebaseSubjectsArguments, this.steps.map(t => t.id));
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, RebaseWriter.READ_LIMITS, signal));
    RebaseWriter.requireSuccess(Resources.logCommand, result);
    const records = result.output.toString(Resources.utf8Encoding).split(Resources.nulCharacter).filter(t => t.length > 0);
    const subjects = new Map(records.map(t => [t.slice(0, t.indexOf(Resources.space)), t.slice(t.indexOf(Resources.space) + 1)]));
    return subjects;
  }

  private static requireSuccess(command: string, result: ProgramResult): void {
    if (result.exit.code !== 0 || result.isTruncated)
      throw new GitFailedException(command, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }
}
