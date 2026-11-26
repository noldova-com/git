/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommitSignature, SignatureState, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { ConfigSetting } from "../models/config-setting.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class CommitSignatureReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.configOutputBytes, Resources.gitReadMilliseconds);
  private static readonly SETTINGS: GitArguments = new GitArguments(Resources.signingConfigArguments);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, id: string, signal?: AbortSignal): Promise<GitCommitSignature> {
    const settings = await this.settingsAsync(top, signal);
    const gitArguments = new GitArguments(Resources.commitSignatureArguments).withRevisions([id]).withSettings(settings);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, CommitSignatureReader.LIMITS, signal));
    if (result.exit.code !== 0 || result.isTruncated)
      throw new GitFailedException(Resources.logCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    const [mark = "", signer = "", key = ""] = result.output.toString(Resources.utf8Encoding).trimEnd().split(Resources.nulCharacter);
    if (mark === Resources.signatureNone && !await this.carriesSignatureAsync(top, id, signal))
      return new GitCommitSignature(id, SignatureState.None, null, null);
    return new GitCommitSignature(id, mark === Resources.signatureVerified ? SignatureState.Verified : SignatureState.Unverified,
      CommitSignatureReader.lineOf(signer), CommitSignatureReader.lineOf(key));
  }

  private async settingsAsync(top: string, signal?: AbortSignal): Promise<string[]> {
    const values = new Map(Resources.signingSettings);
    const result = await this.runner.runAsync(ProgramRun.readGit(CommitSignatureReader.SETTINGS, top, CommitSignatureReader.LIMITS, signal));
    if ((result.exit.code !== 0 && result.exit.code !== Resources.configNotFoundExitCode) || result.isTruncated)
      throw new GitFailedException(Resources.configCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    let program: string | null = null;
    let openPgp: string | null = null;
    for (const line of result.output.toString(Resources.utf8Encoding).split(Resources.lineEnd)) {
      const tab = line.indexOf(Resources.tab);
      const entry = line.slice(tab + 1);
      const space = entry.indexOf(Resources.space);
      const key = space < 0 ? entry : entry.slice(0, space);
      const value = space < 0 ? "" : entry.slice(space + 1);
      if (tab <= 0 || !Resources.personConfigScopes.has(line.slice(0, tab)))
        continue;
      if (key === Resources.openPgpProgramSetting)
        openPgp = value;
      else if (key === Resources.gpgProgramSetting)
        program = value;
      else if (values.has(key))
        values.set(key, value);
    }
    const pinned = openPgp ?? program ?? Resources.defaultGpgProgram;
    const settings: readonly ConfigSetting[] = [new ConfigSetting(Resources.gpgProgramSetting, pinned), new ConfigSetting(Resources.openPgpProgramSetting, pinned),
      ...[...values].map(([key, value]) => new ConfigSetting(key, value))];
    return settings.flatMap(t => [Resources.configOption, Resources.formatSetting(t.key, t.value)]);
  }

  private async carriesSignatureAsync(top: string, id: string, signal?: AbortSignal): Promise<boolean> {
    const gitArguments = new GitArguments(Resources.commitObjectArguments).withRevisions([id]);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, CommitSignatureReader.LIMITS, signal));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.catFileCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    const text = result.output.toString(Resources.utf8Encoding);
    const end = text.indexOf(Resources.headersEnd);
    return (end < 0 ? text : text.slice(0, end)).split(Resources.lineEnd).some(line => Resources.signatureHeaders.some(header => line.startsWith(header)));
  }

  private static lineOf(text: string): string | null {
    const line = LogReader.toLine(text);
    return line.length === 0 ? null : line;
  }
}
