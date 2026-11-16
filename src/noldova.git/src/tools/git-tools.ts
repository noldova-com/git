/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type IToolDescriptor, type IToolHandler, type IToolsContext, type Registration, type ToolCall, ToolRisk } from "@noldova/desktop.runtime";
import { DiffScope, DiffScopeKind, GitBranchParams, GitCommitParams, GitDiffPaths, GitNames, GitPathsParams, type JsonObject } from "@noldova/git.protocol";

import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { Resources } from "../resources.ts";
import { BranchCreateWriter } from "../services/branch-create.writer.ts";
import { BranchSwitchWriter } from "../services/branch-switch.writer.ts";
import type { BranchesReader } from "../services/branches.reader.ts";
import { CheckoutRisksReader } from "../services/checkout-risks.reader.ts";
import { CommitWriter } from "../services/commit.writer.ts";
import type { DiffReader } from "../services/diff.reader.ts";
import type { FilterOptionsReader } from "../services/filter-options.reader.ts";
import type { HooksReader } from "../services/hooks.reader.ts";
import type { KeyQueue } from "../services/key-queue.ts";
import type { LogReader } from "../services/log.reader.ts";
import type { ProgramRunner } from "../services/program-runner.ts";
import { PullWriter } from "../services/pull.writer.ts";
import { PushWriter } from "../services/push.writer.ts";
import type { RepositoryReader } from "../services/repository.reader.ts";
import type { SessionBranches } from "../services/session-branches.ts";
import { StageWriter } from "../services/stage.writer.ts";
import type { StatusReader } from "../services/status.reader.ts";
import { UnstageWriter } from "../services/unstage.writer.ts";
import type { WriteRunner } from "../services/write.runner.ts";
import { GitReadTool } from "./git-read-tool.ts";
import { GitWriteTool } from "./git-write-tool.ts";
import { ToolText } from "./tool-text.ts";

export interface IGitToolParts {
  readonly runner: ProgramRunner;
  readonly repositories: RepositoryReader;
  readonly statuses: StatusReader;
  readonly diffs: DiffReader;
  readonly logs: LogReader;
  readonly branchesReader: BranchesReader;
  readonly hooks: HooksReader;
  readonly filters: FilterOptionsReader;
  readonly reads: KeyQueue;
  readonly writes: WriteRunner;
  readonly sessionBranches: SessionBranches;
}

export class GitTools {
  private static readonly NO_ARGUMENTS: JsonObject = { type: Resources.objectType, properties: {}, additionalProperties: false };
  private static readonly PATHS: JsonObject = {
    type: Resources.arrayType,
    items: { type: Resources.stringType, minLength: 1, maxLength: Resources.maximumToolPathLength },
    minItems: 1,
    maxItems: Resources.maximumToolPaths
  };
  private static readonly NAME: JsonObject = { type: Resources.objectType, properties: {
    [Resources.nameArgument]: { type: Resources.stringType, minLength: 1, maxLength: Resources.maximumBranchLength }
  }, required: [Resources.nameArgument], additionalProperties: false };
  private readonly registrations: Registration[] = [];
  public readonly tools: readonly (IToolHandler & { readonly descriptor: IToolDescriptor })[];

  public constructor(parts: IGitToolParts) {
    const { runner, hooks, filters, sessionBranches } = parts;
    const risks = new CheckoutRisksReader(hooks, filters);
    this.tools = [
      GitTools.read(parts, GitNames.statusTool, Resources.statusToolTitle, Resources.statusToolDescription, GitTools.NO_ARGUMENTS,
        async (folders, call) => ToolText.ofStatus(await parts.statuses.readAsync(folders, call.signal))),
      GitTools.read(parts, GitNames.diffTool, Resources.diffToolTitle, Resources.diffToolDescription, {
        type: Resources.objectType,
        properties: { [Resources.stagedArgument]: { type: Resources.booleanType }, [Resources.pathsArgument]: GitTools.PATHS },
        additionalProperties: false
      }, async (folders, call) => {
        const checked = new GitDiffPaths(GitTools.pathsOf(call)).paths;
        const scope = new DiffScope(call.arguments[Resources.stagedArgument] === true ? DiffScopeKind.Staged : DiffScopeKind.Worktree);
        return ToolText.ofDiff(await parts.diffs.readAsync(folders.top, scope, checked, call.signal));
      }),
      GitTools.read(parts, GitNames.logTool, Resources.logToolTitle, Resources.logToolDescription, {
        type: Resources.objectType,
        properties: { [Resources.limitArgument]: { type: Resources.integerType, minimum: 1, maximum: Resources.maximumLogLimit } },
        additionalProperties: false
      }, async (folders, call) => {
        const limit = call.arguments[Resources.limitArgument];
        return ToolText.ofLog(await parts.logs.readAsync(folders.top, typeof limit === "number" ? limit : Resources.defaultLogLimit, call.signal));
      }),
      GitTools.read(parts, GitNames.branchesTool, Resources.branchesToolTitle, Resources.branchesToolDescription, GitTools.NO_ARGUMENTS,
        async (folders, call) => ToolText.ofBranches(await parts.branchesReader.readAsync(folders.top, call.signal))),
      GitTools.write(parts, GitNames.stageTool, Resources.stageToolTitle, Resources.stageToolDescription, ToolRisk.Low, GitTools.pathsSchema(),
        (top, basedOn, call) => new StageWriter(runner, hooks, filters, new GitPathsParams(top, GitTools.pathsOf(call), basedOn).paths)),
      GitTools.write(parts, GitNames.unstageTool, Resources.unstageToolTitle, Resources.unstageToolDescription, ToolRisk.Low, GitTools.pathsSchema(),
        (top, basedOn, call) => new UnstageWriter(runner, hooks, new GitPathsParams(top, GitTools.pathsOf(call), basedOn).paths)),
      GitTools.write(parts, GitNames.createBranchTool, Resources.createBranchToolTitle, Resources.createBranchToolDescription, ToolRisk.Low, GitTools.NAME,
        (top, basedOn, call) => new BranchCreateWriter(runner, hooks, GitTools.branchOf(top, basedOn, call), sessionBranches, call.session)),
      GitTools.write(parts, GitNames.switchBranchTool, Resources.switchBranchToolTitle, Resources.switchBranchToolDescription, ToolRisk.Medium, GitTools.NAME,
        (top, basedOn, call) => new BranchSwitchWriter(runner, risks, GitTools.branchOf(top, basedOn, call))),
      GitTools.write(parts, GitNames.commitTool, Resources.commitToolTitle, Resources.commitToolDescription, ToolRisk.Medium, {
        type: Resources.objectType,
        properties: {
          [Resources.messageArgument]: { type: Resources.stringType, minLength: 1, maxLength: Resources.maximumMessageLength, pattern: Resources.notBlankPattern }
        },
        required: [Resources.messageArgument],
        additionalProperties: false
      }, (top, basedOn, call) => new CommitWriter(runner, hooks, new GitCommitParams(top, GitTools.textOf(call, Resources.messageArgument), basedOn).message)),
      GitTools.write(parts, GitNames.pushTool, Resources.pushToolTitle, Resources.pushToolDescription, ToolRisk.High, GitTools.NO_ARGUMENTS,
        () => new PushWriter(runner, hooks, sessionBranches)),
      GitTools.write(parts, GitNames.pullTool, Resources.pullToolTitle, Resources.pullToolDescription, ToolRisk.Medium, GitTools.NO_ARGUMENTS,
        () => new PullWriter(runner, risks))
    ];
  }

  public publish(tools: IToolsContext): void {
    for (const tool of this.tools)
      this.registrations.push(tools.register(tool.descriptor, tool));
  }

  public dispose(): void {
    for (const registration of this.registrations.splice(0))
      registration[Symbol.dispose]();
  }

  private static read(
    parts: IGitToolParts,
    name: string,
    title: string,
    description: string,
    inputSchema: JsonObject,
    read: ConstructorParameters<typeof GitReadTool>[3]): GitReadTool {
    return new GitReadTool({
      name,
      title,
      description,
      inputSchema,
      hints: { isReadOnly: true, isDestructive: false, isOpenWorld: false },
      risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
      deadline: { default: Resources.readToolDeadline, maximum: Resources.toolMaximumDeadline }
    }, parts.repositories, parts.reads, read);
  }

  private static write(
    parts: IGitToolParts,
    name: string,
    title: string,
    description: string,
    risk: ToolRisk,
    inputSchema: JsonObject,
    create: (top: string, basedOn: string, call: ToolCall) => IGitWrite): GitWriteTool {
    return new GitWriteTool({
      name,
      title,
      description,
      inputSchema,
      hints: { isReadOnly: false, isDestructive: false, isOpenWorld: name === GitNames.pushTool || name === GitNames.pullTool },
      risk: { default: risk, maximum: risk },
      marksSending: true,
      deadline: { default: Resources.writeToolDeadline, maximum: Resources.toolMaximumDeadline },
      resource: Resources.formatBindingResource(GitNames.folderBinding),
      nextTool: GitNames.statusTool
    }, parts.repositories, parts.statuses, parts.reads, parts.writes, create);
  }

  private static pathsSchema(): JsonObject {
    return { type: Resources.objectType, properties: { [Resources.pathsArgument]: GitTools.PATHS }, required: [Resources.pathsArgument], additionalProperties: false };
  }

  private static pathsOf(call: ToolCall): string[] {
    const paths = call.arguments[Resources.pathsArgument];
    return Array.isArray(paths) ? paths.filter(t => typeof t === "string") : [];
  }

  private static textOf(call: ToolCall, name: string): string {
    return String(call.arguments[name]);
  }

  private static branchOf(top: string, basedOn: string, call: ToolCall): string {
    return new GitBranchParams(top, GitTools.textOf(call, Resources.nameArgument), basedOn).name;
  }
}
