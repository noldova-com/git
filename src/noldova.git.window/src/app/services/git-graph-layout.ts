/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { GitCommit, GitGraphCommit } from "@noldova/git.protocol";

import { GitGraphLine } from "../models/git-graph-line.ts";
import { GitGraphRow } from "../models/git-graph-row.ts";
import { GitLane } from "../models/git-lane.ts";
import { GitLaneTarget } from "../models/git-lane-target.ts";
import { Resources } from "../../resources.ts";

export class GitGraphLayout {
  public static layout(commits: readonly GitGraphCommit[]): GitGraphRow[] {
    let lanes: readonly GitLane[] = [];
    let nextColor = 0;
    const newColor = (): number => nextColor++ % Resources.graphColorCount;
    const rows: GitGraphRow[] = [];
    for (const shown of commits) {
      const commit: GitCommit = shown.commit;
      const before: readonly GitLane[] = lanes;
      let lane: number = before.findIndex(t => t.waiting === commit.id);
      if (lane === -1)
        lane = GitGraphLayout.freeLane(before);
      const after: GitLane[] = before.map(t => t.waiting === commit.id ? t.freed() : t);
      const current: GitLane | undefined = before[lane];
      let color: number;
      if (Object.isUndefined(current)) {
        color = newColor();
        after.push(new GitLane(null, color, false));
      }
      else if (current.waiting !== commit.id) {
        color = newColor();
        after[lane] = new GitLane(null, color, false);
      }
      else
        color = current.color;
      const side: boolean = current?.waiting === commit.id && current.isSide;
      const targets: GitLaneTarget[] = [];
      const moved: Map<number, number> = new Map<number, number>();
      for (const [order, parent] of commit.parents.entries()) {
        const waiting: GitLane | undefined = after.find(t => t.waiting === parent);
        const at: number = Object.isUndefined(waiting) ? -1 : after.indexOf(waiting);
        if (!Object.isUndefined(waiting) && (order > 0 || at < lane || !waiting.isSide)) {
          targets.push(new GitLaneTarget(at, order === 0 ? color : waiting.color));
          continue;
        }
        if (!Object.isUndefined(waiting)) {
          after[at] = waiting.freed();
          moved.set(at, lane);
        }
        const target: number = order === 0 ? lane : GitGraphLayout.freeLane(after, lane);
        const targetColor: number = target === lane ? color : newColor();
        after[target] = new GitLane(parent, targetColor, target === lane ? side : true);
        targets.push(new GitLaneTarget(target, targetColor));
      }
      const lines: GitGraphLine[] = [];
      for (const [index, { waiting, color: laneColor }] of before.entries()) {
        if (waiting === commit.id)
          lines.push(new GitGraphLine(index, false, lane, true, laneColor));
        else if (!Object.isNull(waiting))
          lines.push(new GitGraphLine(index, false, moved.get(index) ?? index, false, laneColor));
      }
      for (const target of targets)
        lines.push(new GitGraphLine(lane, true, target.lane, false, target.color));
      after.length = after.findLastIndex(t => !Object.isNull(t.waiting)) + 1;
      rows.push(new GitGraphRow(shown, lane, color, lines, Math.max(before.length, after.length, lane + 1)));
      lanes = after;
    }
    return rows;
  }

  private static freeLane(lanes: readonly GitLane[], taken: number = -1): number {
    for (const [index, { waiting }] of lanes.entries())
      if (Object.isNull(waiting) && index !== taken)
        return index;
    return lanes.length;
  }
}
