/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { GitVersion } from "../../src/models/git-version.ts";
import { FilePresence } from "../../src/services/file-presence.ts";

export class RepositoryFixture {
  private static readonly PREFIX: string = "noldova-git-test-";
  private static readonly DATE: string = "2026-01-01T00:00:00Z";
  private static readonly PROMPT_SCRIPT: string = [
    "process.stderr.write(\"The test fixture's fake prompt refuses to answer.\\n\");",
    "process.exitCode = 1;",
    ""
  ].join("\n");
  private static readonly GIT_CONFIGURATION: string = [
    "[user]",
    "\tname = Noldova Test",
    "\temail = test@example.invalid",
    "[init]",
    "\tdefaultBranch = main",
    "[core]",
    "\tautocrlf = false",
    "[maintenance]",
    "\tauto = false",
    ""
  ].join("\n");
  private readonly git: string;

  public readonly root: string;
  public readonly folder: string;
  public readonly gitFolder: string;
  public readonly home: string;
  public readonly configuration: string;
  public readonly programs: string;
  public readonly prompt: string;

  private constructor(root: string, git: string) {
    this.root = root;
    this.folder = path.join(root, "repository");
    this.gitFolder = path.join(this.folder, ".git");
    this.home = path.join(root, "home");
    this.configuration = path.join(root, "configuration");
    this.programs = path.join(root, "programs");
    this.prompt = path.join(root, "prompt", "fake-prompt");
    this.git = git;
  }

  public static async createAsync(template?: RepositoryFixture): Promise<RepositoryFixture> {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), RepositoryFixture.PREFIX)));
    try {
      return await RepositoryFixture.prepareAsync(new RepositoryFixture(root, await RepositoryFixture.findGitAsync()), template);
    }
    catch (error) {
      await Promise.allSettled([rm(root, { recursive: true, force: true })]);
      throw error;
    }
  }

  private static async prepareAsync(fixture: RepositoryFixture, template: RepositoryFixture | undefined): Promise<RepositoryFixture> {
    for (const folder of [fixture.folder, fixture.home, fixture.configuration, fixture.programs, path.dirname(fixture.prompt)])
      await mkdir(folder, { recursive: true });
    await writeFile(path.join(fixture.home, ".gitconfig"), RepositoryFixture.GIT_CONFIGURATION);
    await writeFile(`${fixture.prompt}.js`, RepositoryFixture.PROMPT_SCRIPT);
    await writeFile(fixture.prompt, `#!/bin/sh\nexec "${process.execPath.replaceAll("\\", "/")}" "${fixture.prompt.replaceAll("\\", "/")}.js" "$@"\n`);
    await chmod(fixture.prompt, 0o755);
    if (template !== undefined) {
      await cp(template.folder, fixture.folder, { recursive: true });
      return fixture;
    }
    await fixture.runGitAsync(["init", "--quiet"]);
    await fixture.writeAsync("a.txt", "a\n");
    await fixture.runGitAsync(["add", "a.txt"]);
    await fixture.runGitAsync(["commit", "--quiet", "-m", "Start"]);
    return fixture;
  }

  public async writeAsync(file: string, content: string | Buffer): Promise<void> {
    await writeFile(path.join(this.folder, file), content);
  }

  public async runGitAsync(gitArguments: readonly string[], input: string = ""): Promise<string> {
    const running = promisify(execFile)(this.git, [...gitArguments], {
      cwd: this.folder,
      env: this.isolatedEnvironment(),
      maxBuffer: 64 * 1024 * 1024
    });
    let inputFailure: Error | null = null;
    running.child.stdin?.on("error", (error: NodeJS.ErrnoException) => {
      if (!RepositoryFixture.isClosedPipe(error))
        inputFailure = error;
    });
    running.child.stdin?.end(input);
    return (await running.finally(() => {
      if (inputFailure !== null)
        throw inputFailure;
    })).stdout;
  }

  /** Whether the git these tests run is at least this version, for a test of a feature an older git lacks, such as Apple's git on a Mac. */
  public async hasGitAsync(version: GitVersion): Promise<boolean> {
    const [found, foundMajor, foundMinor] = /^git version (\d+)\.(\d+)/v.exec(await this.runGitAsync(["version"])) ?? [];
    return found !== undefined && version.isReachedBy(Number(foundMajor), Number(foundMinor));
  }

  public supervisorEnvironment(searchPath: string = process.env["PATH"] ?? ""): Record<string, string> {
    return {
      ...this.windowsEnvironment(),
      PATH: searchPath,
      TEMP: tmpdir(),
      TMP: tmpdir(),
      TMPDIR: tmpdir(),
      HOME: this.home,
      USERPROFILE: this.home,
      XDG_CONFIG_HOME: this.configuration
    };
  }

  public async disposeAsync(): Promise<void> {
    await rm(this.root, { recursive: true, force: true });
  }

  private static async findGitAsync(): Promise<string> {
    const names = process.platform === "win32" ? ["git.exe"] : ["git"];
    for (const folder of (process.env["PATH"] ?? "").split(path.delimiter).filter(t => path.isAbsolute(t)))
      for (const name of names)
        if (await FilePresence.existsAsync(path.join(folder, name)))
          return path.join(folder, name);
    throw new Error("The tests need git on the PATH.");
  }

  private static isClosedPipe(error: NodeJS.ErrnoException): boolean {
    return error.code === "EPIPE" || (process.platform === "win32" && error.code === "EOF");
  }

  private isolatedEnvironment(): Record<string, string> {
    return {
      ...this.supervisorEnvironment(),
      LC_ALL: "C",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: path.join(this.home, ".gitconfig"),
      GIT_CEILING_DIRECTORIES: this.root,
      GIT_ALLOW_PROTOCOL: "file",
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: this.prompt,
      SSH_ASKPASS: this.prompt,
      GIT_EDITOR: `"${this.prompt.replaceAll("\\", "/")}"`,
      GIT_AUTHOR_DATE: RepositoryFixture.DATE,
      GIT_COMMITTER_DATE: RepositoryFixture.DATE
    };
  }

  private windowsEnvironment(): Record<string, string> {
    const environment: Record<string, string> = {};
    for (const name of ["SystemRoot", "windir", "PATHEXT", "ComSpec"]) {
      const value = process.env[name];
      if (value !== undefined)
        environment[name] = value;
    }
    return environment;
  }
}
