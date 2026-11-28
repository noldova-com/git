/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { addAbortListener } from "node:events";
import type { Readable } from "node:stream";
import timers from "node:timers";

import "@noldova/context.core";
import { type IRuntimePartContext, type OwnedProcess, ProgramNotFoundException } from "@noldova/desktop.runtime";

import { Program } from "../enums/program.ts";
import { GhMissingException } from "../exceptions/gh-missing.exception.ts";
import { GitMissingException } from "../exceptions/git-missing.exception.ts";
import { IndexLockedException } from "../exceptions/index-locked.exception.ts";
import { ProgramTimedOutException } from "../exceptions/program-timed-out.exception.ts";
import { CapturedOutput } from "../models/captured-output.ts";
import { ProgramRequest } from "../models/program-request.ts";
import { ProgramResult } from "../models/program-result.ts";
import type { ProgramRun } from "../models/program-run.ts";
import { Required } from "../models/required.ts";
import { Resources } from "../resources.ts";
import type { CommandLog } from "./command-log.ts";
import { WriteQueue } from "./write-queue.ts";

export class ProgramRunner {
  private readonly context: Pick<IRuntimePartContext, "startProcessAsync">;
  private readonly writes: WriteQueue = new WriteQueue();
  private readonly commands: CommandLog | null;

  public constructor(context: Pick<IRuntimePartContext, "startProcessAsync">, commands: CommandLog | null = null) {
    this.context = context;
    this.commands = commands;
  }

  public async runAsync(run: ProgramRun): Promise<ProgramResult> {
    const commonGitFolder = run.commonGitFolder;
    if (Object.isNull(commonGitFolder))
      return await this.startAsync(run);
    return await this.writes.runAsync(commonGitFolder, async () => {
      const finish = run.isLogged ? this.commands?.start(commonGitFolder, run.arguments) : undefined;
      let exitCode: number | null = null;
      try {
        const result = await this.startAsync(run);
        exitCode = result.exit.code;
        return result;
      } finally {
        finish?.(exitCode);
      }
    });
  }

  private async startAsync(run: ProgramRun): Promise<ProgramResult> {
    const limit = new AbortController();
    const timer: NodeJS.Timeout = timers.setTimeout(() => limit.abort(), run.limits.milliseconds);
    const signal = Object.isUndefined(run.signal) ? limit.signal : AbortSignal.any([run.signal, limit.signal]);
    const request = new ProgramRequest(run, signal);
    try {
      const process = await this.startProcessAsync(run, request, limit.signal);
      const result = await this.collectAsync(process, run.input, request.program, run.limits.outputBytes, signal).finally(() => this.throwIfStopped(run, request, limit.signal));
      if (ProgramRunner.isIndexLocked(run, result))
        throw new IndexLockedException();
      return result;
    } finally {
      timers.clearTimeout(timer);
    }
  }

  private async startProcessAsync(run: ProgramRun, request: ProgramRequest, limit: AbortSignal): Promise<OwnedProcess> {
    try {
      return await this.context.startProcessAsync(request);
    } catch (error) {
      this.throwIfStopped(run, request, limit);
      if (!(error instanceof ProgramNotFoundException))
        throw error;
      throw run.program === Program.Git ? new GitMissingException(request.program, error) : new GhMissingException(request.program, error);
    }
  }

  private async collectAsync(process: OwnedProcess, input: Buffer, program: string, outputBytes: number, stop: AbortSignal): Promise<ProgramResult> {
    let stopping: Promise<unknown> = Promise.resolve();
    process.input.on("error", () => undefined);
    process.input.end(input);
    const listening = addAbortListener(stop, () => void process.exited.then(() => {
      process.output.destroy();
      process.errors.destroy();
    }));
    try {
      const [output, errors, exit] = await Promise.all([
        this.readAsync(process.output, program, outputBytes, () => stopping = process.stopAsync()),
        this.readAsync(process.errors, program, Resources.errorsOutputBytes),
        process.exited
      ]);
      return new ProgramResult(exit, output.bytes, errors.bytes, output.isTruncated);
    } finally {
      listening[Symbol.dispose]();
      await stopping;
    }
  }

  private async readAsync(stream: Readable, program: string, limit: number, onLimit?: () => void): Promise<CapturedOutput> {
    const chunks: Buffer[] = [];
    let size = 0;
    let isTruncated = false;
    for await (const chunk of stream) {
      if (isTruncated)
        continue;
      const bytes = Required.bytes(chunk, program, Resources.outputPart);
      const room = limit - size;
      if (bytes.length > room) {
        chunks.push(bytes.subarray(0, room));
        size = limit;
        isTruncated = true;
        onLimit?.();
      } else {
        chunks.push(bytes);
        size += bytes.length;
      }
    }
    return new CapturedOutput(Buffer.concat(chunks), isTruncated);
  }

  private throwIfStopped(run: ProgramRun, request: ProgramRequest, limit: AbortSignal): void {
    if (run.signal?.aborted === true)
      throw run.signal.reason;
    if (limit.aborted)
      throw new ProgramTimedOutException(request.program, run.limits.milliseconds);
  }

  private static isIndexLocked(run: ProgramRun, result: ProgramResult): boolean {
    return !Object.isNull(run.gitFolder) && result.exit.code === Resources.gitFatalExitCode && Resources.indexLockedPattern.test(result.errors.toString(Resources.utf8Encoding));
  }
}
