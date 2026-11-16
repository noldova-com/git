/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { IToolDescriptor, IToolHandler, ToolCall, ToolResult } from "@noldova/desktop.runtime";
import type { GitStatus } from "@noldova/git.protocol";

import { GitFailureException } from "../exceptions/git-failure.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import type { KeyQueue } from "../services/key-queue.ts";
import type { RepositoryReader } from "../services/repository.reader.ts";
import type { StatusReader } from "../services/status.reader.ts";
import type { WriteRunner } from "../services/write.runner.ts";
import { BoundFolder } from "./bound-folder.ts";
import { GitToolFailures } from "./git-tool-failures.ts";
import { ToolText } from "./tool-text.ts";

export class GitWriteTool implements IToolHandler {
  private readonly repositories: RepositoryReader;
  private readonly statuses: StatusReader;
  private readonly reads: KeyQueue;
  private readonly writes: WriteRunner;
  private readonly create: (top: string, basedOn: string, call: ToolCall) => IGitWrite;

  public readonly descriptor: IToolDescriptor;

  public constructor(
    descriptor: IToolDescriptor,
    repositories: RepositoryReader,
    statuses: StatusReader,
    reads: KeyQueue,
    writes: WriteRunner,
    create: (top: string, basedOn: string, call: ToolCall) => IGitWrite) {
    this.descriptor = descriptor;
    this.repositories = repositories;
    this.statuses = statuses;
    this.reads = reads;
    this.writes = writes;
    this.create = create;
  }

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    const folder = BoundFolder.of(call);
    try {
      const folders = await this.repositories.readAsync(folder);
      const before = await this.reads.runAsync(folders.top, () => this.statuses.readAsync(folders, call.signal));
      await this.writes.runAsync(folders, before.fingerprint, this.create(folders.top, before.fingerprint, call), call, call.signal);
      return await this.afterAsync(folders, call);
    } catch (error) {
      throw GitToolFailures.fromError(error, call.hasMarkedSending, call.signal.aborted);
    }
  }

  private async afterAsync(folders: RepositoryFolders, call: ToolCall): Promise<ToolResult> {
    let after: GitStatus;
    try {
      after = await this.reads.runAsync(folders.top, () => this.statuses.readAsync(folders, call.signal));
    } catch (error) {
      if (!(error instanceof GitFailureException))
        throw error;
      return BoundFolder.resultOf(Resources.formatWriteDoneUnread(String(error)));
    }
    return BoundFolder.resultOf(ToolText.ofStatus(after));
  }
}
