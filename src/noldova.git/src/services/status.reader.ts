/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type GitStatus, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import { FilterOptionsReader } from "./filter-options.reader.ts";
import { LineCountsReader } from "./line-counts.reader.ts";
import { OperationReader } from "./operation.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";
import { RemoteReader } from "./remote.reader.ts";
import { StatusFingerprint } from "./status-fingerprint.ts";
import { StatusParser } from "./status.parser.ts";

export class StatusReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.statusArguments);
  private readonly runner: ProgramRunner;
  private readonly counts: LineCountsReader;
  private readonly remotes: RemoteReader;
  private readonly filters: FilterOptionsReader;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
    this.counts = new LineCountsReader(runner);
    this.remotes = new RemoteReader(runner);
    this.filters = new FilterOptionsReader(runner);
  }

  public async readAsync(folders: RepositoryFolders, signal?: AbortSignal): Promise<GitStatus> {
    const filters = await this.filters.readAsync(folders.top, signal);
    const result = await this.runner.runAsync(ProgramRun.readGit(StatusReader.ARGUMENTS.withSettings(filters), folders.top, StatusReader.LIMITS, signal));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.statusCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    const parsed = StatusParser.parse(result.output, result.isTruncated, Resources.statusEntriesLimit);
    const [entries, fingerprint, operation, remote] = await Promise.all([
      this.counts.countAsync(folders.top, parsed.entries, filters, signal),
      StatusFingerprint.readAsync(folders.top, folders.gitFolder, result.output, parsed),
      OperationReader.readAsync(folders.gitFolder),
      this.remotes.readAsync(folders.top, parsed.branch, signal)
    ]);
    return parsed.toStatus(entries, fingerprint, operation, remote);
  }
}
