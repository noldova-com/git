/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRebasePlan } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";

export interface IGitRebaseStop {
  readonly step: number;
  readonly paths: readonly string[];
  readonly commit: string;
}

export class GitRebasePreview {
  public readonly folder: string;
  public readonly plan: GitRebasePlan;
  public readonly onto: string;
  public readonly count: number;
  public readonly stacked: readonly string[];
  public readonly after: readonly string[];
  public readonly stop: IGitRebaseStop | null;
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

  public get branch(): string {
    return this.plan.branch ?? Resources.headLabel;
  }

  public get base(): string {
    return this.plan.base.slice(0, Resources.shortIdLength);
  }

  public get ontoCommit(): string {
    return this.plan.onto.slice(0, Resources.shortIdLength);
  }
}
