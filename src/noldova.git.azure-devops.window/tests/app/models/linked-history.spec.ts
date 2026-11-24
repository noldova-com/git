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
  return new GitGraphCommit(new GitCommit(id.repeat(40), [], "Mona Lisa", "2026-11-22T10:00:00Z", subject), "ana@fabrikam.com", []);
}

const commits: readonly GitGraphCommit[] = [
  commitOf("a", "Fold the tag case in the note list filter #4832"),
  commitOf("b", "Read local times AB#4831 and AB#4799"),
  commitOf("c", "Tag case #4832, again #4832 and AB#4832"),
  commitOf("d", "Tidy x#4799, ab#4799, #4799x and docs/#4799")
];

function idsOf(history: LinkedHistory, organization: string, id: number): readonly string[] {
  return history.commitsOf(organization, id).map(t => t.id.slice(0, 1));
}

describe("LinkedHistory", () => {
  it("finds each work item a subject names as #N or AB#N in a repository on Azure DevOps, newest first, each commit once", () => {
    const history: LinkedHistory = LinkedHistory.of(commits, [], "fabrikam", false);

    expect([idsOf(history, "fabrikam", 4832), idsOf(history, "Fabrikam", 4831), idsOf(history, "fabrikam", 4799), idsOf(history, "fabrikam", 4700),
      history.isRead, history.isTruncated]).toEqual([["a", "c"], ["b"], ["b"], [], true, false]);
  });

  it("adds the AB#N a commit's whole message names, in the history's order, each commit once, and ignores a commit the history didn't read", () => {
    const messages: readonly GitMessageReference[] = [new GitMessageReference("d".repeat(40), [4700, 4831]), new GitMessageReference("a".repeat(40), [4832, 4700]),
      new GitMessageReference("e".repeat(40), [4700])];
    const history: LinkedHistory = LinkedHistory.of(commits, messages, "fabrikam", false);

    expect([idsOf(history, "fabrikam", 4700), idsOf(history, "fabrikam", 4832), idsOf(history, "fabrikam", 4831)]).toEqual([["a", "d"], ["a", "c"], ["b", "d"]]);
  });

  it("matches no #N glued to a word, a path or an address, nor ab#N in lower case", () => {
    const history: LinkedHistory = LinkedHistory.of([commits[3] ?? commitOf("e", "")], [], "fabrikam", true);

    expect([idsOf(history, "fabrikam", 4799), history.isTruncated]).toEqual([[], true]);
  });

  it("names no work item of another organization than the repository's", () => {
    expect(idsOf(LinkedHistory.of(commits, [], "contoso", false), "fabrikam", 4832)).toEqual([]);
  });

  it("cuts a subject into its plain text and the work items it names, in order, as the subject writes them", () => {
    const history: LinkedHistory = LinkedHistory.of(commits, [], "fabrikam", false);

    expect([history.partsOf("Read local times AB#4831 and #4799"), history.partsOf("#4832 tag case"), history.partsOf("Tidy x#4799"),
      LinkedHistory.none.partsOf("Tag case #4832")]).toEqual([
      [new SubjectPart("Read local times ", null), new SubjectPart("AB#4831", 4831), new SubjectPart(" and ", null), new SubjectPart("#4799", 4799)],
      [new SubjectPart("#4832", 4832), new SubjectPart(" tag case", null)], [new SubjectPart("Tidy x#4799", null)], [new SubjectPart("Tag case #4832", null)]
    ]);
  });

  it("matches #N and AB#N nowhere in a repository that isn't on Azure DevOps, so it has no history to show", () => {
    const history: LinkedHistory = LinkedHistory.of(commits, [new GitMessageReference("a".repeat(40), [4700])], null, true);

    expect([history, idsOf(history, "fabrikam", 4832), history.isRead]).toEqual([LinkedHistory.none, [], false]);
  });
});
