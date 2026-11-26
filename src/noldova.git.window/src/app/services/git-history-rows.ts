/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { GitCommit, GitGraphCommit, GitRef, RefKind } from "@noldova/git.protocol";

import { GitHistoryRow } from "../models/git-history-row.ts";
import { GitRefChip } from "../models/git-ref-chip.ts";
import { CommitLabels } from "./commit-labels.ts";
import { GitGraphLayout } from "./git-graph-layout.ts";
import { Resources } from "../../resources.ts";

export class GitHistoryRows {
  public static switchedTo(commits: readonly GitGraphCommit[], branch: string | null): readonly GitGraphCommit[] {
    if (Object.isNull(branch) || !commits.some(t => t.refs.some(r => r.kind === RefKind.Branch && r.name === branch)))
      return commits;
    return commits.map(commit => {
      const isTarget: boolean = commit.refs.some(r => r.kind === RefKind.Branch && r.name === branch);
      const hasHead: boolean = commit.refs.some(r => r.kind === RefKind.Head);
      if (!isTarget && !hasHead)
        return commit;
      const refs: GitRef[] = commit.refs.filter(r => r.kind !== RefKind.Head);
      return new GitGraphCommit(commit.commit, commit.email, isTarget ? [new GitRef(RefKind.Head, branch), ...refs] : refs);
    });
  }

  public static rowsOf(commits: readonly GitGraphCommit[], changedFiles: number, filter: string, now: Date): GitHistoryRow[] {
    const headCommit: GitCommit | null = commits.find(t => t.refs.some(r => r.kind === RefKind.Head))?.commit ?? null;
    const head: string | null = headCommit?.id ?? null;
    const changes: GitGraphCommit | null = changedFiles > 0 && !Object.isNull(headCommit)
      ? new GitGraphCommit(new GitCommit(Resources.changesId, [headCommit.id], "", headCommit.authoredAt, Resources.formatChangedFiles(changedFiles)), "", [])
      : null;
    const graph = GitGraphLayout.layout([...(Object.isNull(changes) ? [] : [changes]), ...commits]);
    const query: string = filter.trim().toLocaleLowerCase(Resources.dateLocale);
    const offset: number = Object.isNull(changes) ? 0 : 1;
    return graph.map((row, index) => {
      if (index < offset)
        return new GitHistoryRow(row, [], true, false, row.commit.subject, "", "", "", Resources.ageNow, query.length === 0);
      const { refs, email } = row.shown;
      const author: string = row.commit.author;
      const matches: boolean = query.length === 0 || [row.commit.subject, author, email, row.commit.id, ...refs.map(t => t.name)]
        .some(t => t.toLocaleLowerCase(Resources.dateLocale).includes(query));
      return new GitHistoryRow(row, GitRefChip.remotesApart(GitRefChip.chipsOf(refs)), false, row.commit.id === head, row.commit.subject, author, CommitLabels.initialsOf(author),
        CommitLabels.avatarOf(email), CommitLabels.ageOf(row.commit.authoredAt, now), matches);
    });
  }
}
