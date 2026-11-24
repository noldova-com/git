/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { Access } from "../enums/access.ts";
import { Program } from "../enums/program.ts";
import { FolderNotAbsoluteException } from "../exceptions/folder-not-absolute.exception.ts";
import { Resources } from "../resources.ts";
import type { GitArguments } from "./git-arguments.ts";
import type { ProgramLimits } from "./program-limits.ts";

export class ProgramRun {
  public readonly program: Program;
  public readonly access: Access;
  public readonly arguments: readonly string[];
  public readonly workingFolder: string;
  public readonly gitFolder: string | null;
  public readonly commonGitFolder: string | null;
  public readonly limits: ProgramLimits;
  public readonly signal: AbortSignal | undefined;
  /** What the program reads on its standard input, such as `cat-file --batch`'s object names; empty for most runs. */
  public readonly input: Buffer;
  /** Whether a write's command shows in the command log; false for the module's own bookkeeping, such as the index snapshot an undo needs. */
  public readonly isLogged: boolean;

  private constructor(
    program: Program,
    access: Access,
    launchArguments: readonly string[],
    workingFolder: string,
    gitFolder: string | null,
    commonGitFolder: string | null,
    limits: ProgramLimits,
    signal?: AbortSignal,
    input: Buffer = Buffer.alloc(0),
    isLogged: boolean = true) {
    ProgramRun.requireAbsolute(Resources.workingFolderName, workingFolder);
    ProgramRun.requireAbsolute(Resources.gitFolderName, gitFolder);
    ProgramRun.requireAbsolute(Resources.commonGitFolderName, commonGitFolder);
    this.program = program;
    this.access = access;
    this.arguments = launchArguments;
    this.workingFolder = workingFolder;
    this.gitFolder = gitFolder;
    this.commonGitFolder = commonGitFolder;
    this.limits = limits;
    if (signal !== undefined)
      this.signal = signal;
    this.input = input;
    this.isLogged = isLogged;
  }

  public static readGit(gitArguments: GitArguments, workingFolder: string, limits: ProgramLimits, signal?: AbortSignal): ProgramRun {
    return new ProgramRun(Program.Git, Access.Read, gitArguments.values, workingFolder, null, null, limits, signal);
  }

  /** The same read, given `input` on its standard input. */
  public withInput(input: Buffer): ProgramRun {
    return new ProgramRun(this.program, this.access, this.arguments, this.workingFolder, this.gitFolder, this.commonGitFolder, this.limits, this.signal, input,
      this.isLogged);
  }

  /** The same run, left out of the command log. */
  public unlogged(): ProgramRun {
    return new ProgramRun(this.program, this.access, this.arguments, this.workingFolder, this.gitFolder, this.commonGitFolder, this.limits, this.signal, this.input,
      false);
  }

  public static writeGit(
    gitArguments: GitArguments,
    workingFolder: string,
    gitFolder: string,
    commonGitFolder: string,
    limits: ProgramLimits,
    signal?: AbortSignal): ProgramRun {
    return new ProgramRun(Program.Git, Access.Write, gitArguments.withLiteralPaths().values, workingFolder, gitFolder, commonGitFolder, limits, signal);
  }

  public static runGh(access: Access, ghArguments: readonly string[], workingFolder: string, limits: ProgramLimits, signal?: AbortSignal): ProgramRun {
    return new ProgramRun(Program.Gh, access, ghArguments, workingFolder, null, null, limits, signal);
  }

  private static requireAbsolute(name: string, folder: string | null): void {
    if (folder !== null && !path.isAbsolute(folder))
      throw new FolderNotAbsoluteException(name, folder);
  }
}
