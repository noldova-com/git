/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants } from "node:fs";
import path from "node:path";

import { UntrustedSource } from "@noldova/git.protocol";

import { FolderUnreadableException } from "../exceptions/folder-unreadable.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { NotARepositoryException } from "../exceptions/not-a-repository.exception.ts";
import { RepositoryNotAbsoluteException } from "../exceptions/repository-not-absolute.exception.ts";
import { UnsafeRepositoryException } from "../exceptions/unsafe-repository.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";
import type { GitVersionReader } from "./git-version.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class RepositoryReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.repositoryArguments);
  private static readonly REF_STORAGE: GitArguments = new GitArguments(Resources.refStorageArguments);
  private readonly runner: ProgramRunner;
  private readonly version: GitVersionReader;

  public constructor(runner: ProgramRunner, version: GitVersionReader) {
    this.runner = runner;
    this.version = version;
  }

  public async readAsync(folder: string): Promise<RepositoryFolders> {
    if (!path.isAbsolute(folder))
      throw new RepositoryNotAbsoluteException(folder);
    if (!await RepositoryReader.isPresentAsync(folder))
      throw new NotARepositoryException(folder);
    await this.version.requireAsync(folder);
    const result = await this.runner.runAsync(ProgramRun.readGit(RepositoryReader.ARGUMENTS, folder, RepositoryReader.LIMITS));
    const lines = result.output.toString(Resources.utf8Encoding).split(Resources.lineEnd);
    const errors = result.errors.toString(Resources.utf8Encoding);
    if (result.exit.code !== 0 && Resources.unsafeRepositoryPattern.test(errors))
      throw new UnsafeRepositoryException(folder, { text: errors, source: UntrustedSource.Repository });
    if (result.exit.code !== 0 || lines.length !== Resources.repositoryLineCount)
      throw new NotARepositoryException(folder);
    const [top = "", gitFolder = "", commonGitFolder = ""] = lines;
    return new RepositoryFolders(path.resolve(top), path.resolve(gitFolder), path.resolve(commonGitFolder));
  }

  /** Whether git keeps the repository's refs in a reftable, as `extensions.refStorage` says, rather than as files under `refs`. */
  public async isReftableAsync(folders: RepositoryFolders, signal?: AbortSignal): Promise<boolean> {
    const result = await this.runner.runAsync(ProgramRun.readGit(RepositoryReader.REF_STORAGE, folders.top, RepositoryReader.LIMITS, signal));
    if (result.exit.code === Resources.configNotFoundExitCode)
      return false;
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.formatGitCommand(Resources.refStorageArguments), { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.output.toString(Resources.utf8Encoding).trim() === Resources.reftableStorage;
  }

  private static async isPresentAsync(folder: string): Promise<boolean> {
    try {
      return await FilePresence.existsAsync(folder, constants.R_OK | constants.X_OK);
    } catch (error) {
      if (FilePresence.isDenied(error))
        throw new FolderUnreadableException(folder, error);
      throw error;
    }
  }
}
