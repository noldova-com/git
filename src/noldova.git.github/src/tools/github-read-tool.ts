/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { type IToolDescriptor, type IToolHandler, type ToolCall, ToolContent, ToolFailureCode, ToolResult, ToolRisk } from "@noldova/desktop.runtime";
import { type HostItem, HostReference } from "@noldova/git.hosting.protocol";
import { GitHubNames } from "@noldova/git.github.protocol";

import type { IGitHubToken } from "../interfaces/i-github-token.ts";
import { Resources } from "../resources.ts";
import type { GitHubReads } from "../services/github-reads.ts";
import { GitHubToolFailures } from "./github-tool-failures.ts";

export class GitHubReadTool implements IToolHandler {
  private readonly reads: GitHubReads;
  private readonly token: IGitHubToken;

  public readonly descriptor: IToolDescriptor = {
    name: GitHubNames.readTool,
    title: Resources.readToolTitle,
    description: Resources.readToolDescription,
    inputSchema: {
      type: Resources.objectType,
      properties: {
        [Resources.ownerArgument]: { type: Resources.stringType, minLength: Resources.minimumArgumentLength, maxLength: Resources.maximumOwnerLength,
          pattern: Resources.ownerSchemaPattern },
        [Resources.repositoryArgument]: { type: Resources.stringType, minLength: Resources.minimumArgumentLength, maxLength: Resources.maximumRepositoryLength,
          pattern: Resources.repositorySchemaPattern },
        [Resources.numberArgument]: { type: Resources.integerType, minimum: Resources.minimumItemNumber, maximum: Resources.maximumItemNumber }
      },
      required: [Resources.ownerArgument, Resources.repositoryArgument, Resources.numberArgument],
      additionalProperties: false
    },
    hints: { isReadOnly: true, isDestructive: false, isOpenWorld: true },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    deadline: { default: Resources.readToolDeadline, maximum: Resources.readToolMaximumDeadline }
  };

  public constructor(reads: GitHubReads, token: IGitHubToken) {
    this.reads = reads;
    this.token = token;
  }

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    const reference: HostReference = GitHubReadTool.referenceOf(call);
    if (this.token.token === null)
      throw GitHubToolFailures.signedOut();
    let item: HostItem | null;
    try {
      item = await this.reads.readReferenceAsync(reference, call.signal);
    }
    catch (error) {
      throw GitHubToolFailures.fromGitHub(error);
    }
    if (item === null)
      throw this.token.token === null
        ? GitHubToolFailures.signedOut()
        : GitHubToolFailures.fail(ToolFailureCode.Unavailable, Resources.itemNotFoundMessage, Resources.notFoundToolCode);
    return new ToolResult([ToolContent.fromText(JSON.stringify(item.toJson()), Resources.gitHubOrigin)]);
  }

  private static referenceOf(call: ToolCall): HostReference {
    const input: JsonReader = JsonReader.fromValue(call.arguments);
    return new HostReference(GitHubNames.moduleId, input.readString(Resources.ownerArgument), input.readString(Resources.repositoryArgument),
      input.readInteger(Resources.numberArgument));
  }
}
