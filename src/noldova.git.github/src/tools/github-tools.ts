/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IToolHandler, IToolDescriptor, IToolsContext, Registration } from "@noldova/desktop.runtime";
import type { GitRepositories } from "@noldova/git.protocol";

import type { IGitHubTokens } from "../interfaces/i-github-tokens.ts";
import type { GitHubReads } from "../services/github-reads.ts";
import { GitHubPrChecksTool } from "./github-pr-checks-tool.ts";
import { GitHubPrCreateTool } from "./github-pr-create-tool.ts";
import { GitHubReadTool } from "./github-read-tool.ts";

export class GitHubTools {
  private readonly registrations: Registration[] = [];
  public readonly tools: readonly (IToolHandler & { readonly descriptor: IToolDescriptor })[];

  public constructor(reads: GitHubReads, tokens: IGitHubTokens, repositories: () => GitRepositories) {
    this.tools = [new GitHubReadTool(reads, tokens), new GitHubPrChecksTool(reads, tokens, repositories), new GitHubPrCreateTool(reads, tokens, repositories)];
  }

  public publish(tools: IToolsContext): void {
    for (const tool of this.tools)
      this.registrations.push(tools.register(tool.descriptor, tool));
  }

  public dispose(): void {
    for (const registration of this.registrations.splice(0))
      registration[Symbol.dispose]();
  }
}
