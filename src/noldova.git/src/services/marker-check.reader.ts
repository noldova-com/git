/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { GitMarkerCheck, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class MarkerCheckReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.diffOutputBytes, Resources.gitReadMilliseconds);
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.markerCheckArguments, [Resources.headLabel], Resources.markerCheckPaths);
  private static readonly ESCAPED_BYTES: ReadonlyMap<string, number> = new Map([...Resources.cEscapes].map(([byte, letter]) => [letter, byte]));
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readLinesAsync(top: string, signal?: AbortSignal): Promise<readonly string[]> {
    const result = await this.runner.runAsync(ProgramRun.readGit(MarkerCheckReader.ARGUMENTS, top, MarkerCheckReader.LIMITS, signal));
    if (Object.isNull(result.exit.code) || result.exit.code >= Resources.gitFatalExitCode || result.isTruncated)
      throw new GitFailedException(Resources.diffCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.output.toString(Resources.utf8Encoding).match(Resources.leftoverMarkerPattern) ?? [];
  }

  public async readAsync(top: string, signal?: AbortSignal): Promise<GitMarkerCheck> {
    const lines = await this.readLinesAsync(top, signal);
    return new GitMarkerCheck([...new Set(lines.map(t => MarkerCheckReader.unquote(t.replace(Resources.leftoverMarkerEndPattern, ""))))]);
  }

  private static unquote(name: string): string {
    if (!name.startsWith(Resources.quoteMark))
      return name;
    const text = name.slice(1, -1);
    const bytes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text.charAt(i) !== Resources.backslash) {
        bytes.push(text.charCodeAt(i));
        continue;
      }
      const octal = text.slice(i + 1, i + 4);
      if (Resources.octalEscapePattern.test(octal)) {
        bytes.push(Number.parseInt(octal, 8));
        i += 3;
        continue;
      }
      i++;
      bytes.push(MarkerCheckReader.ESCAPED_BYTES.get(text.charAt(i)) ?? text.charCodeAt(i));
    }
    return Buffer.from(bytes).toString(Resources.utf8Encoding);
  }
}
