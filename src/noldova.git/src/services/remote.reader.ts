/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type GitRemote, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { RemoteUrl } from "../models/remote-url.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class RemoteReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.configOutputBytes, Resources.gitReadMilliseconds);
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.remoteConfigArguments);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, branch: string | null, signal?: AbortSignal): Promise<GitRemote | null> {
    const output: string | null = await this.readConfigAsync(top, signal);
    return output === null ? null : this.readChosenAsync(top, output, RemoteReader.choose(output, branch), signal);
  }

  public async readNamedAsync(top: string, name: string, signal?: AbortSignal): Promise<GitRemote | null> {
    const output: string | null = await this.readConfigAsync(top, signal);
    return output === null ? null : this.readChosenAsync(top, output, name, signal);
  }

  private async readChosenAsync(top: string, output: string, name: string | null, signal?: AbortSignal): Promise<GitRemote | null> {
    const configured: string | undefined = name === null ? undefined : RemoteReader.urlsOf(output).get(name);
    return name === null || configured === undefined ? null : await this.readUrlAsync(top, name, configured, signal);
  }

  private async readConfigAsync(top: string, signal?: AbortSignal): Promise<string | null> {
    const result = await this.runner.runAsync(ProgramRun.readGit(RemoteReader.ARGUMENTS, top, RemoteReader.LIMITS, signal));
    if (result.exit.code === Resources.configNotFoundExitCode)
      return null;
    if (result.exit.code !== 0 || result.isTruncated)
      throw new GitFailedException(Resources.configCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.output.toString(Resources.utf8Encoding);
  }

  private async readUrlAsync(top: string, name: string, configured: string, signal?: AbortSignal): Promise<GitRemote> {
    const result = await this.runner.runAsync(ProgramRun.readGit(new GitArguments([...Resources.remoteUrlArguments, name]), top, RemoteReader.LIMITS, signal));
    const url: string = result.exit.code !== 0 || result.isTruncated ? configured : result.output.toString(Resources.utf8Encoding).replace(Resources.lineEndPattern, "");
    return RemoteUrl.toRemote(name, url);
  }

  private static choose(output: string, branch: string | null): string | null {
    const names: readonly string[] = [...RemoteReader.urlsOf(output).keys()];
    const named: string | null = branch === null ? null : RemoteReader.valueOf(output, Resources.formatBranchRemoteKey(branch));
    const chosen: string | undefined = names.find(t => t === named) ?? (names.length === 1 ? names[0] : undefined);
    return chosen ?? null;
  }

  private static urlsOf(output: string): ReadonlyMap<string, string> {
    const urls = new Map<string, string>();
    for (const record of output.split(Resources.recordSeparator)) {
      const key: string = RemoteReader.keyOf(record);
      const name: string = key.slice(Resources.remoteKeyPrefix.length, -Resources.urlKeySuffix.length);
      if (key.startsWith(Resources.remoteKeyPrefix) && key.endsWith(Resources.urlKeySuffix) && !urls.has(name))
        urls.set(name, record.slice(key.length + 1));
    }
    return urls;
  }

  private static valueOf(output: string, key: string): string | null {
    const record: string | undefined = output.split(Resources.recordSeparator).findLast(t => RemoteReader.keyOf(t) === key);
    return record === undefined ? null : record.slice(key.length + 1);
  }

  private static keyOf(record: string): string {
    const line: number = record.indexOf(Resources.lineEnd);
    return line < 0 ? "" : record.slice(0, line);
  }
}
