/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitRebaseCommit, GitRebasePlan, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { RebaseTooLongException } from "../exceptions/rebase-too-long.exception.ts";
import { BranchTip } from "../models/branch-tip.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { ProgramResult } from "../models/program-result.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

/**
 * Reads what rebasing HEAD onto a commit would replay, as `git rebase -i` lists it: the commits past the merge base, oldest first and without
 * merges, each `fixup!`, `squash!` or `amend!` commit paired with the earlier commit its subject names, the other local branches on those commits,
 * and whether the branch's upstream already has the oldest of them. It changes nothing.
 */
export class RebasePlanReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly LIST_LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, onto: string, signal?: AbortSignal): Promise<GitRebasePlan> {
    const branch = await this.readBranchAsync(top, signal);
    const base = (await this.readTextAsync(top, new GitArguments(Resources.mergeBaseArguments, [Resources.headRevision, onto]), Resources.mergeBaseCommand,
      RebasePlanReader.LIMITS, signal)).trim();
    const range = Resources.formatRange(base, Resources.headRevision);
    const count = Number((await this.readTextAsync(top, new GitArguments(Resources.rebaseCountArguments, [range]), Resources.revListCommand,
      RebasePlanReader.LIMITS, signal)).trim());
    if (count > Resources.maximumRebaseCommits)
      throw new RebaseTooLongException();
    const ontoAhead = Number((await this.readTextAsync(top, new GitArguments(Resources.rangeCountArguments, [Resources.formatRange(base, onto)]),
      Resources.revListCommand, RebasePlanReader.LIMITS, signal)).trim());
    const commits = RebasePlanReader.pair(await this.readCommitsAsync(top, range, signal));
    const ids: ReadonlySet<string> = new Set(commits.map(t => t.id));
    const stacked = (await this.readBranchTipsAsync(top, signal)).filter(t => ids.has(t.id) && t.name !== branch).map(t => t.name);
    const oldest = commits[0];
    const pushed = branch !== null && oldest !== undefined && await this.isPushedAsync(top, branch, oldest.id, signal);
    return new GitRebasePlan(branch, onto, base, ontoAhead, commits, stacked, pushed);
  }

  /** Pairs each `fixup!`, `squash!` or `amend!` commit with the nearest earlier commit whose subject is the rest of its subject, or whose id starts with it. */
  public static pair(commits: readonly GitRebaseCommit[]): GitRebaseCommit[] {
    const paired: GitRebaseCommit[] = [];
    for (const commit of commits) {
      const subject = commit.subject;
      let target = subject;
      while (Resources.foldPrefixes.some(t => target.startsWith(t)))
        target = target.slice(target.indexOf(Resources.foldPrefixEnd) + Resources.foldPrefixEnd.length);
      const found = target === subject ? undefined : paired.findLast(t => t.subject === target)
        ?? (Resources.abbreviatedIdPattern.test(target) ? paired.findLast(t => t.id.startsWith(target)) : undefined);
      paired.push(new GitRebaseCommit(commit.id, commit.message, found?.id ?? null));
    }
    return paired;
  }

  private async readBranchAsync(top: string, signal?: AbortSignal): Promise<string | null> {
    const result = await this.runner.runAsync(ProgramRun.readGit(new GitArguments(Resources.shortBranchArguments), top, RebasePlanReader.LIMITS, signal));
    const branch = result.output.toString(Resources.utf8Encoding).trim();
    return result.exit.code === 0 && branch.length > 0 ? branch : null;
  }

  private async readCommitsAsync(top: string, range: string, signal?: AbortSignal): Promise<GitRebaseCommit[]> {
    const text = await this.readTextAsync(top, new GitArguments(Resources.rebaseLogArguments, [range]), Resources.logCommand, RebasePlanReader.LIST_LIMITS, signal);
    return text.split(Resources.nulCharacter).filter(t => t.length > 0).map(t => {
      const end = t.indexOf(Resources.lineEnd);
      return new GitRebaseCommit(t.slice(0, end), t.slice(end + 1).replace(Resources.trailingNewlines, ""), null);
    });
  }

  private async readBranchTipsAsync(top: string, signal?: AbortSignal): Promise<BranchTip[]> {
    const text = await this.readTextAsync(top, new GitArguments(Resources.branchTipsArguments), Resources.forEachRefCommand, RebasePlanReader.LIST_LIMITS, signal);
    return text.split(Resources.lineEnd).filter(t => t.length > 0).map(t => new BranchTip(t.slice(0, t.indexOf(" ")), t.slice(t.indexOf(" ") + 1)));
  }

  private async isPushedAsync(top: string, branch: string, oldest: string, signal?: AbortSignal): Promise<boolean> {
    const upstream = (await this.readTextAsync(top, new GitArguments(Resources.readUpstreamArguments, [Resources.formatBranchRef(branch)]),
      Resources.forEachRefCommand, RebasePlanReader.LIMITS, signal)).trim();
    if (upstream.length === 0)
      return false;
    const result = await this.runner.runAsync(ProgramRun.readGit(new GitArguments(Resources.isAncestorArguments, [oldest, upstream]), top,
      RebasePlanReader.LIMITS, signal));
    if (result.exit.code === Resources.notAncestorExitCode)
      return false;
    RebasePlanReader.requireSuccess(Resources.mergeBaseCommand, result);
    return true;
  }

  private async readTextAsync(top: string, gitArguments: GitArguments, command: string, limits: ProgramLimits, signal?: AbortSignal): Promise<string> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, limits, signal));
    RebasePlanReader.requireSuccess(command, result);
    return result.output.toString(Resources.utf8Encoding);
  }

  private static requireSuccess(command: string, result: ProgramResult): void {
    if (result.exit.code !== 0 || result.isTruncated)
      throw new GitFailedException(command, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }
}
