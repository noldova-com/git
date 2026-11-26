/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommit, GitGraphCommit, GitMessageReference } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { LinkedHistory } from "../../../src/app/models/linked-history.ts";
import { SubjectPart } from "../../../src/app/models/subject-part.ts";

function commitOf(id: string, subject: string): GitGraphCommit {
  return new GitGraphCommit(new GitCommit(id.repeat(40), [], "Mona Lisa", "2026-11-22T10:00:00Z", subject), "kim@fabrikam.test", []);
}

const commits: readonly GitGraphCommit[] = [
  commitOf("a", "Fold the tag case in the note list filter #7532"),
  commitOf("b", "Read local times AB#7531 and AB#7499"),
  commitOf("c", "Tag case #7532, again #7532 and AB#7532"),
  commitOf("d", "Tidy x#7499, ab#7499, #7499x and docs/#7499")
];

function idsOf(history: LinkedHistory, organization: string, id: number): readonly string[] {
  return history.commitsOf(organization, id).map(t => t.id.slice(0, 1));
}

describe("LinkedHistory", () => {
  it("finds each work item a subject names as #N or AB#N in a repository on Azure DevOps, newest first, each commit once", () => {
    const history: LinkedHistory = LinkedHistory.of(commits, [], "fabrikam", false);

    expect([idsOf(history, "fabrikam", 7532), idsOf(history, "Fabrikam", 7531), idsOf(history, "fabrikam", 7499), idsOf(history, "fabrikam", 7400),
      history.isRead, history.isTruncated]).toEqual([["a", "c"], ["b"], ["b"], [], true, false]);
  });

  it("adds the AB#N a commit's whole message names, in the history's order, each commit once, and ignores a commit the history didn't read", () => {
    const messages: readonly GitMessageReference[] = [new GitMessageReference("d".repeat(40), [7400, 7531]), new GitMessageReference("a".repeat(40), [7532, 7400]),
      new GitMessageReference("e".repeat(40), [7400])];
    const history: LinkedHistory = LinkedHistory.of(commits, messages, "fabrikam", false);

    expect([idsOf(history, "fabrikam", 7400), idsOf(history, "fabrikam", 7532), idsOf(history, "fabrikam", 7531)]).toEqual([["a", "d"], ["a", "c"], ["b", "d"]]);
  });

  it("matches no #N glued to a word, a path or an address, nor ab#N in lower case", () => {
    const history: LinkedHistory = LinkedHistory.of([commits[3] ?? commitOf("e", "")], [], "fabrikam", true);

    expect([idsOf(history, "fabrikam", 7499), history.isTruncated]).toEqual([[], true]);
  });

  it("names no work item of another organization than the repository's", () => {
    expect(idsOf(LinkedHistory.of(commits, [], "contoso", false), "fabrikam", 7532)).toEqual([]);
  });

  it("cuts a subject into its plain text and the work items it names, in order, as the subject writes them", () => {
    const history: LinkedHistory = LinkedHistory.of(commits, [], "fabrikam", false);

    expect([history.partsOf("Read local times AB#7531 and #7499"), history.partsOf("#7532 tag case"), history.partsOf("Tidy x#7499"),
      LinkedHistory.none.partsOf("Tag case #7532")]).toEqual([
      [new SubjectPart("Read local times ", null), new SubjectPart("AB#7531", 7531), new SubjectPart(" and ", null), new SubjectPart("#7499", 7499)],
      [new SubjectPart("#7532", 7532), new SubjectPart(" tag case", null)], [new SubjectPart("Tidy x#7499", null)], [new SubjectPart("Tag case #7532", null)]
    ]);
  });

  it("matches #N and AB#N nowhere in a repository that isn't on Azure DevOps, so it has no history to show", () => {
    const history: LinkedHistory = LinkedHistory.of(commits, [new GitMessageReference("a".repeat(40), [7400])], null, true);

    expect([history, idsOf(history, "fabrikam", 7532), history.isRead]).toEqual([LinkedHistory.none, [], false]);
  });
});
