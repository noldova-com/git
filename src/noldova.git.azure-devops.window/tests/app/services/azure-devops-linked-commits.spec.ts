/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import {
  GitCommit, GitFolderParams, GitGraph, GitGraphCommit, GitGraphParams, GitMessageReference, GitMessageReferenceKind, GitMessageReferences, GitMessageReferencesParams,
  GitNames, GitRemote, GitStatus, RemoteTransport
} from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { LinkedHistory } from "../../../src/app/models/linked-history.ts";
import { AzureDevOpsLinkedCommits } from "../../../src/app/services/azure-devops-linked-commits.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";

const FOLDER: string = "/work/portal-web";
const azure: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/Sample%20Project/_git/portal-web", RemoteTransport.Https);

function statusAt(head: string | null, remote: GitRemote | null = azure): GitStatus {
  return new GitStatus("main", head, null, [], false, "f1", null, remote);
}

const graph: GitGraph = new GitGraph([new GitGraphCommit(new GitCommit("a".repeat(40), [], "Mona Lisa", "2026-11-22T10:00:00Z", "Fold tag case #4832"),
  "ana@fabrikam.com", [])], false);
const messages: GitMessageReferences = new GitMessageReferences([new GitMessageReference("a".repeat(40), [4700])], false);

describe("AzureDevOpsLinkedCommits", () => {
  it("reads the status, then the last 1,000 commits and their messages' AB#N once for each HEAD, sharing the history among reads at the same HEAD", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.answer(GitNames.statusMethod, statusAt("a".repeat(40)).toJson(), statusAt("a".repeat(40)).toJson(), statusAt("b".repeat(40)).toJson());
    requests.answer(GitNames.graphMethod, graph.toJson(), graph.toJson());
    requests.answer(GitNames.messageReferencesMethod, messages.toJson(), messages.toJson());
    const reads: AzureDevOpsLinkedCommits = new AzureDevOpsLinkedCommits(context);

    const first: LinkedHistory = await reads.readAsync(FOLDER);
    const again: LinkedHistory = await reads.readAsync(FOLDER);
    const moved: LinkedHistory = await reads.readAsync(FOLDER);

    expect([again === first, moved === first, first.commitsOf("fabrikam", 4832).map(t => t.subject), first.commitsOf("fabrikam", 4700).length]).toEqual([true, false,
      ["Fold tag case #4832"], 1]);
    expect([requests.methods, requests.payloads.slice(0, 3)]).toEqual([[GitNames.statusMethod, GitNames.graphMethod, GitNames.messageReferencesMethod,
      GitNames.statusMethod, GitNames.statusMethod, GitNames.graphMethod, GitNames.messageReferencesMethod], [new GitFolderParams(FOLDER).toJson(),
      new GitGraphParams(FOLDER, 1000, 0).toJson(), new GitMessageReferencesParams(FOLDER, GitMessageReferenceKind.AzureBoards, 1000).toJson()]]);
  });

  it("reads no commits for a repository with no remote or one that isn't on Azure DevOps", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.answer(GitNames.statusMethod, statusAt(null, null).toJson(),
      statusAt(null, new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https)).toJson());
    const reads: AzureDevOpsLinkedCommits = new AzureDevOpsLinkedCommits(context);

    expect([await reads.readAsync(FOLDER), await reads.readAsync(FOLDER), requests.methods]).toEqual([LinkedHistory.none, LinkedHistory.none,
      [GitNames.statusMethod, GitNames.statusMethod]]);
  });

  it("logs a status, commits or messages read the window fails, answers no history, and keeps none, so the next read asks again", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.fail(GitNames.statusMethod, new WindowFailure("No repository."));
    requests.answer(GitNames.statusMethod, statusAt("a".repeat(40)).toJson(), statusAt("a".repeat(40)).toJson(), statusAt("a".repeat(40)).toJson());
    requests.fail(GitNames.graphMethod, new WindowFailure("Busy."));
    requests.answer(GitNames.graphMethod, graph.toJson(), graph.toJson());
    requests.fail(GitNames.messageReferencesMethod, new WindowFailure("Gone."));
    requests.answer(GitNames.messageReferencesMethod, messages.toJson());
    const reads: AzureDevOpsLinkedCommits = new AzureDevOpsLinkedCommits(context);

    const read: LinkedHistory[] = [await reads.readAsync(FOLDER), await reads.readAsync(FOLDER), await reads.readAsync(FOLDER), await reads.readAsync(FOLDER)];

    expect([read.map(t => t.isRead), context.callsOf("log").map(t => t[0])]).toEqual([[false, false, false, true], [
      "The Azure DevOps module's git.status request failed: WindowFailure: No repository.", "The Azure DevOps module's git.graph request failed: WindowFailure: Busy.",
      "The Azure DevOps module's git.messageReferences request failed: WindowFailure: Gone."]]);
  });

  it("rethrows a failure that isn't the window's", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.fail(GitNames.statusMethod, new RangeError("Unexpected."));

    await expect(new AzureDevOpsLinkedCommits(context).readAsync(FOLDER)).rejects.toBeInstanceOf(RangeError);
  });
});
