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
    return output === null ? null : RemoteReader.choose(output, branch);
  }

  public async readNamedAsync(top: string, name: string, signal?: AbortSignal): Promise<GitRemote | null> {
    const output: string | null = await this.readConfigAsync(top, signal);
    return output === null ? null : RemoteReader.find(output, name);
  }

  private async readConfigAsync(top: string, signal?: AbortSignal): Promise<string | null> {
    const result = await this.runner.runAsync(ProgramRun.readGit(RemoteReader.ARGUMENTS, top, RemoteReader.LIMITS, signal));
    if (result.exit.code === Resources.configNotFoundExitCode)
      return null;
    if (result.exit.code !== 0 || result.isTruncated)
      throw new GitFailedException(Resources.configCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.output.toString(Resources.utf8Encoding);
  }

  private static choose(output: string, branch: string | null): GitRemote | null {
    const [urls, named] = RemoteReader.parse(output, branch);
    const remotes = [...urls];
    const chosen = remotes.find(([name]) => name === named) ?? (remotes.length === 1 ? remotes[0] : undefined);
    return chosen === undefined ? null : RemoteUrl.toRemote(chosen[0], chosen[1]);
  }

  private static find(output: string, name: string): GitRemote | null {
    const url: string | undefined = RemoteReader.parse(output, null)[0].get(name);
    return url === undefined ? null : RemoteUrl.toRemote(name, url);
  }

  private static parse(output: string, branch: string | null): readonly [ReadonlyMap<string, string>, string | null] {
    const urls = new Map<string, string>();
    let named: string | null = null;
    for (const record of output.split(Resources.recordSeparator)) {
      const line = record.indexOf(Resources.lineEnd);
      if (line < 0)
        continue;
      const key = record.slice(0, line);
      const value = record.slice(line + 1);
      if (key.startsWith(Resources.remoteKeyPrefix) && key.endsWith(Resources.urlKeySuffix)) {
        const name = key.slice(Resources.remoteKeyPrefix.length, -Resources.urlKeySuffix.length);
        if (!urls.has(name))
          urls.set(name, value);
      } else if (branch !== null && key === Resources.formatBranchRemoteKey(branch))
        named = value;
    }
    return [urls, named];
  }
}
