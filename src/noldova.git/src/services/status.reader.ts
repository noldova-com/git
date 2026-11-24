/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { lstat } from "node:fs/promises";
import path from "node:path";

import { type GitStatus, type StatusUpstream, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { ParsedStatus } from "../models/parsed-status.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";
import { FilterOptionsReader } from "./filter-options.reader.ts";
import { LfsPointerReader } from "./lfs-pointer.reader.ts";
import { LineCountsReader } from "./line-counts.reader.ts";
import { OperationReader } from "./operation.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";
import { RemoteReader } from "./remote.reader.ts";
import { StatusFingerprint } from "./status-fingerprint.ts";
import { StatusParser } from "./status.parser.ts";

export class StatusReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.statusArguments);
  private static readonly UPSTREAM_LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly UPSTREAM: GitArguments = new GitArguments(Resources.upstreamIdArguments);
  private static readonly SUBMODULE_HEAD: GitArguments = new GitArguments(Resources.headCommitCheckArguments);
  private readonly runner: ProgramRunner;
  private readonly counts: LineCountsReader;
  private readonly remotes: RemoteReader;
  private readonly filters: FilterOptionsReader;
  private readonly pointers: LfsPointerReader;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
    this.counts = new LineCountsReader(runner);
    this.remotes = new RemoteReader(runner);
    this.filters = new FilterOptionsReader(runner);
    this.pointers = new LfsPointerReader(runner);
  }

  public async readAsync(folders: RepositoryFolders, signal?: AbortSignal): Promise<GitStatus> {
    const filters = await this.filters.readAsync(folders.top, signal);
    const result = await this.runner.runAsync(ProgramRun.readGit(StatusReader.ARGUMENTS.withSettings(filters), folders.top, StatusReader.LIMITS, signal));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.statusCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    const parsed = StatusParser.parse(result.output, result.isTruncated, Resources.statusEntriesLimit);
    const checked = await this.pointers.cleanAsync(folders.top, parsed.entries, signal);
    const [entries, fingerprint, operation, remote, upstreamId, fetchedAt] = await Promise.all([
      this.counts.countAsync(folders.top, checked.entries, filters, signal),
      this.readFingerprintAsync(folders, result.output, parsed, signal),
      OperationReader.readAsync(folders.gitFolder),
      this.remotes.readAsync(folders.top, parsed.branch, signal),
      this.readUpstreamIdAsync(folders.top, parsed.upstream, signal),
      StatusReader.readFetchedAtAsync(folders.gitFolder)
    ]);
    return parsed.toStatus(entries, fingerprint, operation, remote, checked.unchecked, upstreamId, fetchedAt);
  }

  /** The status's fingerprint, with the commit each listed submodule's HEAD is on, which its status line and folder don't show. */
  private async readFingerprintAsync(folders: RepositoryFolders, output: Buffer, parsed: ParsedStatus, signal?: AbortSignal): Promise<string> {
    const heads = await Promise.all(parsed.entries.filter(t => t.submodule !== null).map(async t => {
      const result = await this.runner.runAsync(ProgramRun.readGit(StatusReader.SUBMODULE_HEAD, path.join(folders.top, t.path), StatusReader.UPSTREAM_LIMITS, signal));
      return Buffer.concat([Buffer.from(`${result.exit.code}${Resources.recordSeparator}`), result.output]);
    }));
    return await StatusFingerprint.readAsync(folders.top, folders.gitFolder, output, parsed, Buffer.concat(heads));
  }

  /** When the worktree last fetched: its `FETCH_HEAD`'s modified time, to the second, or `null` when it never has. */
  private static async readFetchedAtAsync(gitFolder: string): Promise<string | null> {
    try {
      const stats = await lstat(path.join(gitFolder, Resources.fetchHeadFile));
      return stats.mtime.toISOString().replace(Resources.millisecondsPattern, Resources.utcSuffix);
    } catch (error) {
      if (FilePresence.isGone(error))
        return null;
      throw error;
    }
  }

  /** The commit the upstream's tracking ref points at, or null with no upstream, a gone one, or a ref git can't resolve to a commit. */
  private async readUpstreamIdAsync(top: string, upstream: StatusUpstream | null, signal?: AbortSignal): Promise<string | null> {
    if (upstream === null || upstream.gone)
      return null;
    const result = await this.runner.runAsync(ProgramRun.readGit(StatusReader.UPSTREAM, top, StatusReader.UPSTREAM_LIMITS, signal));
    if (result.exit.code === Resources.refMissingExitCode)
      return null;
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.upstreamIdCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.output.toString(Resources.utf8Encoding).trim();
  }
}
