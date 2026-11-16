/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolDescriptor, type IToolHandler, type ToolCall, ToolContent, ToolResult, ToolRisk } from "@noldova/desktop.runtime";
import { BranchPullRequest, BranchQuery } from "@noldova/git.hosting.protocol";
import { GitHubNames } from "@noldova/git.github.protocol";
import type { GitRepositories } from "@noldova/git.protocol";

import type { IGitHubToken } from "../interfaces/i-github-token.ts";
import { Resources } from "../resources.ts";
import type { GitHubReads } from "../services/github-reads.ts";
import { BoundRepository } from "./bound-repository.ts";
import { GitHubToolFailures } from "./github-tool-failures.ts";

export class GitHubPrChecksTool implements IToolHandler {
  private readonly reads: GitHubReads;
  private readonly token: IGitHubToken;
  private readonly repositories: () => GitRepositories;

  public readonly descriptor: IToolDescriptor = {
    name: GitHubNames.prChecksTool,
    title: Resources.prChecksToolTitle,
    description: Resources.prChecksToolDescription,
    inputSchema: { type: Resources.objectType, properties: {}, additionalProperties: false },
    hints: { isReadOnly: true, isDestructive: false, isOpenWorld: true },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    deadline: { default: Resources.readToolDeadline, maximum: Resources.readToolMaximumDeadline }
  };

  public constructor(reads: GitHubReads, token: IGitHubToken, repositories: () => GitRepositories) {
    this.reads = reads;
    this.token = token;
    this.repositories = repositories;
  }

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    const repository: BoundRepository = await BoundRepository.readAsync(call, this.repositories);
    if (this.token.token === null)
      throw GitHubToolFailures.signedOut();
    let answer: BranchPullRequest;
    try {
      answer = await this.reads.readBranchPullRequestAsync(new BranchQuery(repository.host, repository.path, repository.branch, repository.headCommit),
        call.signal);
    } catch (error) {
      throw GitHubToolFailures.fromGitHub(error);
    }
    if (this.token.token === null)
      throw GitHubToolFailures.signedOut();
    return new ToolResult([ToolContent.fromText(JSON.stringify(answer.toJson()), Resources.gitHubOrigin)]);
  }
}
