/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRebasePlan } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";

/** The first step a rebase check sees stop on a conflict, by its number from 1, with the conflicting files and its commit's short id. */
export interface IGitRebaseStop {
  readonly step: number;
  readonly paths: readonly string[];
  readonly commit: string;
}

/** What the Rebase preview view shows of an interactive rebase document: its branch now and as the rows leave it, and where the rows stop. */
export class GitRebasePreview {
  /** The repository's folder, which the subjects' references are found in. */
  public readonly folder: string;
  public readonly plan: GitRebasePlan;
  /** The name of what the branch goes onto. */
  public readonly onto: string;
  /** How many commits the rows hold now. */
  public readonly count: number;
  /** The stacked branches the rebase moves with the branch: none while that option is off. */
  public readonly stacked: readonly string[];
  /** The subjects the branch's commits end with, newest first. */
  public readonly after: readonly string[];
  /** The first step the check sees stop on a conflict, or `null` while none does. */
  public readonly stop: IGitRebaseStop | null;
  /** The first conflicted file once a rebase in the folder really stopped on it, or `null` while none has. */
  public readonly stopped: string | null;

  public constructor(folder: string, plan: GitRebasePlan, onto: string, count: number, stacked: readonly string[], after: readonly string[],
    stop: IGitRebaseStop | null, stopped: string | null) {
    this.folder = folder;
    this.plan = plan;
    this.onto = onto;
    this.count = count;
    this.stacked = stacked;
    this.after = after;
    this.stop = stop;
    this.stopped = stopped;
  }

  /** The branch's name, or HEAD's when it is detached. */
  public get branch(): string {
    return this.plan.branch ?? Resources.headLabel;
  }

  /** The base's short id. */
  public get base(): string {
    return this.plan.base.slice(0, Resources.shortIdLength);
  }

  /** The short id of the commit the branch goes onto. */
  public get ontoCommit(): string {
    return this.plan.onto.slice(0, Resources.shortIdLength);
  }
}
