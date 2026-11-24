/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommand, GitCommandLog } from "@noldova/git.protocol";

import { Resources } from "../resources.ts";
import { MethodFailures } from "./method-failures.ts";

/**
 * The git commands each repository's writes ran while the module runs, newest last, for the command log the window shows.
 * A line holds what the person could type: the settings the module adds and the end-of-options marker are left out, and a URL's name and password never show.
 */
export class CommandLog {
  private readonly commands: Map<string, GitCommand[]> = new Map();
  private readonly now: () => Date;
  private next: number = 1;

  public constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  /** Notes a write's git command as it starts; the returned function records it with its exit code, or `null` when it ended without one. */
  public start(commonGitFolder: string, gitArguments: readonly string[]): (exitCode: number | null) => void {
    const started = this.now();
    return exitCode => {
      const command = new GitCommand(String(this.next++), started.toISOString().replace(Resources.millisecondsPattern, Resources.utcSuffix),
        CommandLog.lineOf(gitArguments), exitCode, Math.max(0, this.now().getTime() - started.getTime()));
      const list = this.commands.get(commonGitFolder) ?? [];
      list.push(command);
      list.splice(0, Math.max(0, list.length - Resources.commandLogLimit));
      this.commands.set(commonGitFolder, list);
    };
  }

  public read(commonGitFolder: string): GitCommandLog {
    return new GitCommandLog([...this.commands.get(commonGitFolder) ?? []]);
  }

  /** The command line: `git` and the arguments past the module's own `-c` settings, each quoted where it has a space, a quote or nothing, in one line. */
  public static lineOf(gitArguments: readonly string[]): string {
    let start = 0;
    while (gitArguments[start] === Resources.configOption)
      start += 2;
    const words = gitArguments.slice(start).filter(t => t !== Resources.endOfOptions).map(t => Resources.unquotedWordPattern.test(t) ? t : `"${t.replaceAll("\"", "\\\"")}"`);
    const line = MethodFailures.stripUserinfo([Resources.gitProgram, ...words].join(" ")).replace(Resources.controlPattern, Resources.replacementCharacter);
    return line.length > Resources.commandLineLimit ? `${line.slice(0, Resources.commandLineLimit - 1)}${Resources.ellipsis}` : line;
  }
}
