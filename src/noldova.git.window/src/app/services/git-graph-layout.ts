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
import { Resources } from "../../resources.ts";

/** A lane: the commit id it waits for, or null while it is free, its color, and whether a merge opened it for its second or later parent. */
type GitLane = readonly [string | null, number, boolean];

/**
 * Lays commits, newest first, into lanes. Each lane waits for one commit id; a commit takes the lane that waits for it, or the first free one,
 * hands that lane to its first parent, and opens a lane for each further parent. A first parent that a merge's side lane further right
 * already waits for is pulled into this lane, so the merged branch ends where it forks off; one that another branch's lane waits for stays
 * there, and this lane curves into it in its own color. Lanes keep their place, so a branch's color stays with it.
 */
export class GitGraphLayout {
  public static layout(commits: readonly GitGraphCommit[]): GitGraphRow[] {
    let lanes: readonly GitLane[] = [];
    let nextColor = 0;
    const newColor = (): number => nextColor++ % Resources.graphColorCount;
    const rows: GitGraphRow[] = [];
    for (const shown of commits) {
      const commit: GitCommit = shown.commit;
      const before: readonly GitLane[] = lanes;
      let lane: number = before.findIndex(t => t[0] === commit.id);
      if (lane === -1)
        lane = GitGraphLayout.freeLane(before);
      const after: GitLane[] = before.map(([waiting, color, side]) => [waiting === commit.id ? null : waiting, color, side]);
      const current: GitLane | undefined = before[lane];
      let color: number;
      if (Object.isUndefined(current)) {
        color = newColor();
        after.push([null, color, false]);
      }
      else if (current[0] !== commit.id) {
        color = newColor();
        after[lane] = [null, color, false];
      }
      else
        color = current[1];
      const side: boolean = current?.[0] === commit.id && current[2];
      const targets: (readonly [number, number])[] = [];
      const moved: Map<number, number> = new Map<number, number>();
      for (const [order, parent] of commit.parents.entries()) {
        const waiting: GitLane | undefined = after.find(t => t[0] === parent);
        const at: number = Object.isUndefined(waiting) ? -1 : after.indexOf(waiting);
        if (!Object.isUndefined(waiting) && (order > 0 || at < lane || !waiting[2])) {
          targets.push([at, order === 0 ? color : waiting[1]]);
          continue;
        }
        if (!Object.isUndefined(waiting)) {
          after[at] = [null, waiting[1], waiting[2]];
          moved.set(at, lane);
        }
        const target: number = order === 0 ? lane : GitGraphLayout.freeLane(after, lane);
        const targetColor: number = target === lane ? color : newColor();
        after[target] = [parent, targetColor, target === lane ? side : true];
        targets.push([target, targetColor]);
      }
      const lines: GitGraphLine[] = [];
      for (const [index, [waiting, laneColor]] of before.entries()) {
        if (waiting === commit.id)
          lines.push(new GitGraphLine(index, false, lane, true, laneColor));
        else if (!Object.isNull(waiting))
          lines.push(new GitGraphLine(index, false, moved.get(index) ?? index, false, laneColor));
      }
      for (const [target, targetColor] of targets)
        lines.push(new GitGraphLine(lane, true, target, false, targetColor));
      after.length = after.findLastIndex(t => !Object.isNull(t[0])) + 1;
      rows.push(new GitGraphRow(shown, lane, color, lines, Math.max(before.length, after.length, lane + 1)));
      lanes = after;
    }
    return rows;
  }

  private static freeLane(lanes: readonly GitLane[], taken: number = -1): number {
    for (const [index, [waiting]] of lanes.entries())
      if (Object.isNull(waiting) && index !== taken)
        return index;
    return lanes.length;
  }
}
