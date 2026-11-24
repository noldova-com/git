/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitCommit, GitGraphCommit, GitMessageReference } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { AzureDevOpsReferenceLinks } from "../services/azure-devops-reference-links.ts";
import { SubjectPart } from "./subject-part.ts";

/**
 * The commits of a repository's recent history that name a work item, by the repository's link rules: in a repository on Azure DevOps, `#N` and
 * `AB#N` in a subject, and `AB#N` anywhere in the message, name its organization's work item N; elsewhere nothing does.
 */
export class LinkedHistory {
  public static readonly none: LinkedHistory = new LinkedHistory(new Map(), null, false, false);

  private readonly byItem: ReadonlyMap<string, readonly GitCommit[]>;
  private readonly home: string | null;
  /** Whether a repository on Azure DevOps was read, so the page has a history to show. */
  public readonly isRead: boolean;
  /** Whether the history goes on past the commits read. */
  public readonly isTruncated: boolean;

  private constructor(byItem: ReadonlyMap<string, readonly GitCommit[]>, home: string | null, isRead: boolean, isTruncated: boolean) {
    this.byItem = byItem;
    this.home = home;
    this.isRead = isRead;
    this.isTruncated = isTruncated;
  }

  /** The commits that name a work item, newest first, or none. */
  public commitsOf(organization: string, id: number): readonly GitCommit[] {
    return this.byItem.get(Resources.formatWorkItemKey(organization, id)) ?? [];
  }

  /** A subject cut into its plain text and the work items it names by the repository's link rules, in order; all plain outside Azure DevOps. */
  public partsOf(subject: string): readonly SubjectPart[] {
    const parts: SubjectPart[] = [];
    let end: number = 0;
    for (const { start, length } of AzureDevOpsReferenceLinks.inText(subject, this.home)) {
      if (start > end)
        parts.push(new SubjectPart(subject.slice(end, start), null));
      const text: string = subject.slice(start, start + length);
      parts.push(new SubjectPart(text, LinkedHistory.idOf(text)));
      end = start + length;
    }
    if (end < subject.length)
      parts.push(new SubjectPart(subject.slice(end), null));
    return parts;
  }

  /**
   * Matches each commit's subject once against the link rules of the repository's organization, adding the `AB#N` its whole message names, as
   * `git.messageReferences` found them, or none for a repository not on Azure DevOps.
   */
  public static of(commits: readonly GitGraphCommit[], messages: readonly GitMessageReference[], home: string | null, isTruncated: boolean): LinkedHistory {
    if (home === null)
      return LinkedHistory.none;
    const named: ReadonlyMap<string, readonly number[]> = new Map(messages.map(t => [t.id, t.numbers]));
    const byItem: Map<string, GitCommit[]> = new Map();
    for (const { commit } of commits) {
      const ids: readonly number[] = AzureDevOpsReferenceLinks.inText(commit.subject, home)
        .map(t => LinkedHistory.idOf(commit.subject.slice(t.start, t.start + t.length)));
      const keys: ReadonlySet<string> = new Set([...ids, ...(named.get(commit.id) ?? [])].map(t => Resources.formatWorkItemKey(home, t)));
      for (const key of keys)
        byItem.set(key, [...(byItem.get(key) ?? []), commit]);
    }
    return new LinkedHistory(byItem, home, true, isTruncated);
  }

  private static idOf(reference: string): number {
    return Number(reference.slice(reference.indexOf(Resources.textNumberMark) + 1));
  }
}
