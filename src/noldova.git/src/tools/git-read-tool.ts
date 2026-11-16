/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { IToolDescriptor, IToolHandler, ToolCall, ToolResult } from "@noldova/desktop.runtime";

import type { RepositoryFolders } from "../models/repository-folders.ts";
import type { KeyQueue } from "../services/key-queue.ts";
import type { RepositoryReader } from "../services/repository.reader.ts";
import { BoundFolder } from "./bound-folder.ts";
import { GitToolFailures } from "./git-tool-failures.ts";

export class GitReadTool implements IToolHandler {
  private readonly repositories: RepositoryReader;
  private readonly reads: KeyQueue;
  private readonly read: (folders: RepositoryFolders, call: ToolCall) => Promise<string | null>;

  public readonly descriptor: IToolDescriptor;

  public constructor(
    descriptor: IToolDescriptor,
    repositories: RepositoryReader,
    reads: KeyQueue,
    read: (folders: RepositoryFolders, call: ToolCall) => Promise<string | null>) {
    this.descriptor = descriptor;
    this.repositories = repositories;
    this.reads = reads;
    this.read = read;
  }

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    const folder = BoundFolder.of(call);
    let text: string | null;
    try {
      const folders = await this.repositories.readAsync(folder);
      text = await this.reads.runAsync(folders.top, () => this.read(folders, call));
    } catch (error) {
      throw GitToolFailures.fromError(error, false, call.signal.aborted);
    }
    return BoundFolder.resultOf(text);
  }
}
