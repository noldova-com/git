/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { GitBranches, GitDiff, GitLog, GitStatus, type JsonObject } from "@noldova/git.protocol";

import { Resources } from "../resources.ts";

export class ToolText {
  public static ofStatus(status: GitStatus): string | null {
    const { entries } = status;
    return ToolText.fit(entries.length, kept => new GitStatus(status.branch, status.head, status.upstream, entries.slice(0, kept),
      status.truncated || kept < entries.length, status.fingerprint, status.operation, status.remote, status.uncheckedLfsFiles, status.fetchedAt).toJson());
  }

  public static ofDiff(diff: GitDiff): string | null {
    const { files } = diff;
    return ToolText.fit(files.length, kept => new GitDiff(files.slice(0, kept), diff.totalBytes, diff.omittedFiles + files.length - kept,
      diff.truncated || kept < files.length).toJson());
  }

  public static ofLog(log: GitLog): string | null {
    const { commits } = log;
    return ToolText.fit(commits.length, kept => new GitLog(commits.slice(0, kept), log.truncated || kept < commits.length).toJson());
  }

  public static ofBranches(branches: GitBranches): string | null {
    const { current, remotes, remoteBranches, tracks, tips } = branches;
    const local = branches.branches;
    return ToolText.fit(remoteBranches.length, kept =>
      ({ ...new GitBranches(current, local, remotes, remoteBranches.slice(0, kept), tracks, tips).toJson(), truncated: kept < remoteBranches.length }))
      ?? ToolText.fit(local.length, kept => {
        const shown: readonly string[] = local.slice(0, kept);
        return { ...new GitBranches(current, shown, remotes, [], tracks.filter(t => shown.includes(t.branch)),
          tips.filter(t => shown.includes(t.branch))).toJson(), truncated: true };
      });
  }

  private static fit(count: number, build: (kept: number) => JsonObject): string | null {
    const whole = JSON.stringify(build(count));
    if (ToolText.fits(whole))
      return whole;
    let low = 0;
    let high = count - 1;
    let best: string | null = null;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const text = JSON.stringify(build(middle));
      if (ToolText.fits(text)) {
        best = text;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return best;
  }

  private static fits(text: string): boolean {
    return Buffer.byteLength(text) <= Resources.toolResultBytes;
  }
}
