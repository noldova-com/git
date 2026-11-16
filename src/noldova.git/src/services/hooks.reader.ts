/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import fs from "node:fs/promises";
import path from "node:path";

import { HooksUnreadableException } from "../exceptions/hooks-unreadable.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class HooksReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.hooksPathArguments);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, names: readonly string[], signal?: AbortSignal): Promise<readonly string[] | null> {
    const result = await this.runner.runAsync(ProgramRun.readGit(HooksReader.ARGUMENTS, top, HooksReader.LIMITS, signal));
    if (result.exit.code !== 0)
      return null;
    const folder = path.resolve(top, result.output.toString(Resources.utf8Encoding).replace(Resources.lineEndPattern, ""));
    const found = await Promise.all(names.map(async t => ({ name: t, isRunnable: await HooksReader.isRunnableAsync(path.join(folder, t)) })));
    if (found.some(t => t.isRunnable === null))
      return null;
    return found.filter(t => t.isRunnable === true).map(t => t.name);
  }

  public async readKnownAsync(top: string, names: readonly string[], signal?: AbortSignal): Promise<readonly string[]> {
    const found = await this.readAsync(top, names, signal);
    if (found === null)
      throw new HooksUnreadableException();
    return found;
  }

  private static async isRunnableAsync(file: string): Promise<boolean | null> {
    try {
      return await HooksReader.readRunnableAsync(file);
    } catch (error) {
      if (FilePresence.isGone(error))
        return false;
      if (FilePresence.isUnreadable(error))
        return null;
      throw error;
    }
  }

  private static async readRunnableAsync(file: string): Promise<boolean> {
    const stats = await fs.stat(file);
    if (!stats.isFile())
      return false;
    const handle = await fs.open(file, Resources.readFlag);
    const start = Buffer.alloc(Resources.hookStartLength);
    try {
      await handle.read(start, 0, start.length, 0);
    } finally {
      await handle.close();
    }
    return (stats.mode & Resources.executableModeBits) !== 0 || Resources.hookStarts[process.platform].includes(start.toString(Resources.latin1Encoding));
  }
}
