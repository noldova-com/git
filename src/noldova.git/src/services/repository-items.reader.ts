/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitRepositoryItems, GitStash, GitSubmodule, GitTag, ProtocolException, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { ProgramResult } from "../models/program-result.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

/**
 * Reads a repository's tags, newest first, its stashes, newest first, and the submodules its index holds, each cut at `Resources.repositoryItemsLimit`.
 * An entry the protocol refuses, such as a tag whose name is too long for one line, is left out and the answer says it was cut.
 */
export class RepositoryItemsReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private static readonly HAS_STASH: GitArguments = new GitArguments(Resources.stashExistsArguments);
  private static readonly SUBMODULES: GitArguments = new GitArguments(Resources.indexListArguments);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, signal?: AbortSignal): Promise<GitRepositoryItems> {
    const [tags, stashes, submodules] = await Promise.all([this.tagsAsync(top, signal), this.stashesAsync(top, signal), this.submodulesAsync(top, signal)]);
    return new GitRepositoryItems(tags.items, stashes.items, submodules.items, tags.cut || stashes.cut || submodules.cut);
  }

  private async tagsAsync(top: string, signal?: AbortSignal): Promise<{ readonly items: GitTag[]; readonly cut: boolean }> {
    const lines = RepositoryItemsReader.linesOf(await this.runAsync(top, new GitArguments([...Resources.tagListArguments, Resources.formatRefCount(Resources.repositoryItemsLimit + 1), Resources.tagsRef]),
      Resources.forEachRefCommand, signal));
    return RepositoryItemsReader.kept(lines, line => {
      const [name = "", peeled = "", id = ""] = line.split(Resources.nulCharacter);
      return GitTag.fromJson({ [Resources.nameField]: name, [Resources.idField]: peeled.length > 0 ? peeled : id });
    });
  }

  private async stashesAsync(top: string, signal?: AbortSignal): Promise<{ readonly items: GitStash[]; readonly cut: boolean }> {
    const exists = await this.runner.runAsync(ProgramRun.readGit(RepositoryItemsReader.HAS_STASH, top, RepositoryItemsReader.LIMITS, signal));
    if (exists.exit.code !== 0)
      return { items: [], cut: false };
    const lines = RepositoryItemsReader.linesOf(await this.runAsync(top,
      new GitArguments([...Resources.stashListArguments, Resources.formatMaxCount(Resources.repositoryItemsLimit + 1), Resources.stashRef]), Resources.stashListCommand, signal));
    let index = 0;
    return RepositoryItemsReader.kept(lines, line => {
      const space = line.indexOf(Resources.space);
      return new GitStash(index++, line.slice(space + 1), line.slice(0, space));
    });
  }

  private async submodulesAsync(top: string, signal?: AbortSignal): Promise<{ readonly items: GitSubmodule[]; readonly cut: boolean }> {
    const result = await this.runner.runAsync(ProgramRun.readGit(RepositoryItemsReader.SUBMODULES, top, RepositoryItemsReader.LIMITS, signal));
    RepositoryItemsReader.requireSuccess(result, Resources.lsFilesCommand);
    const records = result.output.toString(Resources.utf8Encoding).split(Resources.nulCharacter)
      .map(t => Resources.submoduleRecordPattern.exec(t)).filter(t => t !== null);
    const kept = RepositoryItemsReader.kept(records.map(([, id = "", path = ""]) => `${id}${Resources.nulCharacter}${path}`), record => {
      const [id = "", path = ""] = record.split(Resources.nulCharacter);
      return new GitSubmodule(path, id);
    });
    return { items: kept.items, cut: kept.cut || result.isTruncated };
  }

  private async runAsync(top: string, gitArguments: GitArguments, command: string, signal?: AbortSignal): Promise<string> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, RepositoryItemsReader.LIMITS, signal));
    RepositoryItemsReader.requireSuccess(result, command);
    return result.output.toString(Resources.utf8Encoding);
  }

  private static requireSuccess(result: ProgramResult, command: string): void {
    if (result.exit.code !== 0)
      throw new GitFailedException(command, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }

  private static linesOf(text: string): string[] {
    return text.split(Resources.lineEnd).filter(t => t.length > 0);
  }

  /** The items the protocol takes, up to the limit, and whether any were left out, past the limit or refused. */
  private static kept<T>(records: readonly string[], make: (record: string) => T): { readonly items: T[]; readonly cut: boolean } {
    const items: T[] = [];
    let cut = records.length > Resources.repositoryItemsLimit;
    for (const record of records.slice(0, Resources.repositoryItemsLimit))
      try {
        items.push(make(record));
      } catch (error) {
        if (!(error instanceof ProtocolException))
          throw error;
        cut = true;
      }
    return { items, cut };
  }
}
