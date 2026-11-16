/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn, spawnSync } from "node:child_process";

import { ProcessOutputTooLongException } from "../exceptions/process-output-too-long.exception.ts";
import { ProcessStartFailedException } from "../exceptions/process-start-failed.exception.ts";
import { ProcessTimeoutException } from "../exceptions/process-timeout.exception.ts";
import type { ProcessException } from "../exceptions/process.exception.ts";
import { ProcessResult } from "../models/process-result.ts";
import { Resources } from "../resources.ts";

export class ProcessRunner {
  public captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number): Promise<ProcessResult> {
    return new Promise<ProcessResult>((resolve, reject) => {
      const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: Resources.capturedStdio, windowsHide: true });
      const output: Buffer[] = [];
      const errorOutput: Buffer[] = [];
      const timers: NodeJS.Timeout[] = [];
      let size = 0;
      let failure: ProcessException | null = null;
      let isSettled = false;
      const settle = (exitCode: number | null): void => {
        if (isSettled)
          return;
        isSettled = true;
        for (const timer of timers)
          clearTimeout(timer);
        child.stdout.destroy();
        child.stderr.destroy();
        if (failure === null)
          resolve(new ProcessResult(exitCode, Buffer.concat(output).toString(Resources.encoding), Buffer.concat(errorOutput).toString(Resources.encoding)));
        else
          reject(failure);
      };
      const waitForStreams = (exitCode: number | null): void => {
        timers.push(setTimeout(() => settle(exitCode), Resources.streamWaitMilliseconds));
      };
      const stop = (t: ProcessException): void => {
        if (failure !== null)
          return;
        failure = t;
        timers.push(ProcessRunner.stopTree(child.pid, () => waitForStreams(null)));
      };
      const receive = (chunks: Buffer[], chunk: Buffer): void => {
        size += chunk.length;
        if (size > Resources.outputLimitBytes)
          stop(new ProcessOutputTooLongException(command, Resources.outputLimitBytes));
        else
          chunks.push(chunk);
      };
      timers.push(setTimeout(() => stop(new ProcessTimeoutException(command, timeout)), timeout));
      child.stdout.on("data", (t: Buffer) => receive(output, t));
      child.stderr.on("data", (t: Buffer) => receive(errorOutput, t));
      child.on("error", t => stop(new ProcessStartFailedException(command, t)));
      child.once("exit", t => waitForStreams(t));
      child.once("close", t => settle(t));
    });
  }

  public async runAsync(program: string, parameters: readonly string[], folder: string, timeout?: number): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
      const child = spawn(program, parameters, { cwd: folder, stdio: Resources.inheritedStdio });
      const timers: NodeJS.Timeout[] = [];
      let failure: ProcessException | null = null;
      let isSettled = false;
      const settle = (exitCode: number): void => {
        if (isSettled)
          return;
        isSettled = true;
        for (const timer of timers)
          clearTimeout(timer);
        if (failure === null)
          resolve(exitCode);
        else
          reject(failure);
      };
      if (timeout !== undefined)
        timers.push(setTimeout(() => {
          failure = new ProcessTimeoutException(Resources.formatCommand(program, parameters), timeout);
          timers.push(ProcessRunner.stopTree(child.pid, () => settle(Resources.failureExitCode)));
        }, timeout));
      child.once("error", t => {
        failure ??= new ProcessStartFailedException(program, t);
        settle(Resources.failureExitCode);
      });
      child.once("exit", (code, signal) => settle(code ?? (signal === null ? Resources.failureExitCode : Resources.signalExitCode)));
    });
  }

  private static stopTree(pid: number | undefined, forced: () => void): NodeJS.Timeout {
    const tree: readonly number[] = pid === undefined ? [] : ProcessRunner.listTree(pid);
    ProcessRunner.signalTree(tree, false);
    return setTimeout(() => {
      ProcessRunner.signalTree(tree, true);
      forced();
    }, Resources.stopGraceMilliseconds);
  }

  private static listTree(pid: number): readonly number[] {
    if (process.platform === Resources.windowsPlatform)
      return [pid];
    const listed = spawnSync(Resources.processListCommand, Resources.processListArguments, { encoding: Resources.encoding, timeout: Resources.processListTimeoutMilliseconds });
    const children = new Map<number, number[]>();
    for (const line of listed.error === undefined ? listed.stdout.split(Resources.lineEnd) : []) {
      const [id, parent] = line.trim().split(Resources.processListSeparator).map(Number);
      if (id !== undefined && parent !== undefined && Number.isInteger(id) && Number.isInteger(parent))
        children.set(parent, [...(children.get(parent) ?? []), id]);
    }
    const tree: number[] = [pid];
    for (const id of tree)
      tree.push(...(children.get(id) ?? []));
    return tree;
  }

  private static signalTree(tree: readonly number[], isForced: boolean): void {
    for (const pid of tree) {
      if (process.platform === Resources.windowsPlatform) {
        spawnSync(Resources.taskKillCommand, [...Resources.taskKillArguments, String(pid), ...(isForced ? [Resources.taskKillForce] : [])],
          { stdio: Resources.ignoredStdio, windowsHide: true, timeout: Resources.processListTimeoutMilliseconds });
        continue;
      }
      try {
        process.kill(pid, isForced ? Resources.forceSignal : Resources.stopSignal);
      }
      catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === Resources.processGoneCode))
          throw error;
      }
    }
  }
}
