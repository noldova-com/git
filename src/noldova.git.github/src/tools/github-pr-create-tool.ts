/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { type IPermissionDetail, type IPermissionRequest, type IToolDescriptor, type IToolHandler, PermissionDetailKind, PermissionOption,
  type PermissionOutcome, type ToolCall, ToolContent, ToolFailureCode, ToolResult, ToolRisk } from "@noldova/desktop.runtime";
import { HostingProtocolException, type HostItem, PullRequestDraft } from "@noldova/git.hosting.protocol";
import { GitHubNames } from "@noldova/git.github.protocol";
import { GitNames, type GitRepositories } from "@noldova/git.protocol";

import type { IGitHubTokens } from "../interfaces/i-github-tokens.ts";
import { Resources } from "../resources.ts";
import type { GitHubReads } from "../services/github-reads.ts";
import { BoundRepository } from "./bound-repository.ts";
import { GitHubToolFailures } from "./github-tool-failures.ts";

export class GitHubPrCreateTool implements IToolHandler {
  private readonly reads: GitHubReads;
  private readonly tokens: IGitHubTokens;
  private readonly repositories: () => GitRepositories;

  public readonly descriptor: IToolDescriptor = {
    name: GitHubNames.prCreateTool,
    title: Resources.prCreateToolTitle,
    description: Resources.prCreateToolDescription,
    inputSchema: {
      type: Resources.objectType,
      properties: {
        [Resources.titleArgument]: { type: Resources.stringType, minLength: Resources.minimumArgumentLength, maxLength: Resources.maximumTitleLength,
          pattern: Resources.oneLinePattern },
        [Resources.baseArgument]: { type: Resources.stringType, minLength: Resources.minimumArgumentLength, maxLength: Resources.maximumBranchLength,
          pattern: Resources.notBlankPattern },
        [Resources.bodyArgument]: { type: Resources.stringType, maxLength: Resources.maximumBodyLength },
        [Resources.draftArgument]: { type: Resources.booleanType }
      },
      required: [Resources.titleArgument, Resources.baseArgument],
      additionalProperties: false
    },
    hints: { isReadOnly: false, isDestructive: false, isOpenWorld: true },
    risk: { default: ToolRisk.High, maximum: ToolRisk.High },
    marksSending: true,
    deadline: { default: Resources.createToolDeadline, maximum: Resources.createToolMaximumDeadline },
    resource: Resources.formatBindingResource(GitNames.folderBinding),
    nextTool: GitHubNames.prChecksTool
  };

  public constructor(reads: GitHubReads, tokens: IGitHubTokens, repositories: () => GitRepositories) {
    this.reads = reads;
    this.tokens = tokens;
    this.repositories = repositories;
  }

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    const repository: BoundRepository = await BoundRepository.readAsync(call, this.repositories);
    const draft: PullRequestDraft = GitHubPrCreateTool.draftOf(call, repository);
    if (this.tokens.signedIn.length === 0)
      throw GitHubToolFailures.signedOut();
    const request: IPermissionRequest = {
      action: GitHubNames.createPullRequestMethod,
      subject: Resources.formatDraftSubject(draft.host, draft.path),
      title: Resources.formatCreateRequestTitle(draft.path, draft.isDraft),
      details: GitHubPrCreateTool.detailsOf(draft),
      risk: ToolRisk.High,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    };
    const outcome: PermissionOutcome = await call.requestPermissionAsync(request);
    if (!outcome.isAllowed)
      throw GitHubToolFailures.notGranted(outcome.decision);
    call.markSending();
    let created: HostItem;
    try {
      created = await this.reads.createPullRequestAsync(draft, call.signal);
    } catch (error) {
      throw GitHubToolFailures.fromGitHub(error);
    }
    return new ToolResult([ToolContent.fromText(JSON.stringify(created.toJson()), Resources.gitHubOrigin)]);
  }

  private static draftOf(call: ToolCall, repository: BoundRepository): PullRequestDraft {
    const input: JsonReader = JsonReader.fromValue(call.arguments);
    try {
      return new PullRequestDraft(repository.host, repository.path, repository.branch, input.readString(Resources.baseArgument),
        input.readString(Resources.titleArgument), input.hasField(Resources.bodyArgument) ? input.readString(Resources.bodyArgument) : "",
        input.hasField(Resources.draftArgument) && input.readBoolean(Resources.draftArgument));
    } catch (error) {
      if (!(error instanceof HostingProtocolException))
        throw error;
      throw GitHubToolFailures.fail(ToolFailureCode.Refused, String(error), null);
    }
  }

  private static detailsOf(draft: PullRequestDraft): readonly IPermissionDetail[] {
    const details: IPermissionDetail[] = [
      { label: Resources.branchLabel, kind: PermissionDetailKind.Code, value: Resources.formatBranches(draft.headBranch, draft.baseBranch) },
      { label: Resources.titleLabel, kind: PermissionDetailKind.AgentText, value: draft.title },
      { label: Resources.draftLabel, kind: PermissionDetailKind.Text, value: draft.isDraft ? Resources.yes : Resources.no }
    ];
    const body: string = draft.body.trimEnd();
    if (body.trim().length > 0)
      details.push({ label: Resources.bodyLabel, kind: PermissionDetailKind.AgentText, value: Resources.formatBody(body) });
    return details;
  }
}
