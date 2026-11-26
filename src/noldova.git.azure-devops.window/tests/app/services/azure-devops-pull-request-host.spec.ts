/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import "@noldova/context.core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostReference } from "@noldova/git.hosting.protocol";
import { GitNames, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { GitFolder } from "@noldova/git.window";
import { describe, expect, it, onTestFinished } from "vitest";

import { AzureDevOpsAuthorAvatars } from "../../../src/app/services/azure-devops-author-avatars.ts";
import { AzureDevOpsPullRequestHost } from "../../../src/app/services/azure-devops-pull-request-host.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";

const URL: string = "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/752";
const FOLDER: string = "/work/site";
const statusOf = (path: string | null): GitStatus => new GitStatus("main", "a".repeat(40), null, [], false, "f1", null,
  Object.isNull(path) ? null : new GitRemote("origin", "dev.azure.com", path, RemoteTransport.Https));

describe("AzureDevOpsPullRequestHost", () => {
  it("names Azure DevOps and its pull request reads, and makes a commit's page from the pull request's", () => {
    const host: AzureDevOpsPullRequestHost = new AzureDevOpsPullRequestHost(new FakeWindowPartContext());

    expect([host.name, host.readCommitsMethod, host.readChangesMethod, host.readConflictsMethod, host.commitPageOf(URL, "9fceb02")]).toEqual(["Azure DevOps",
      AzureDevOpsNames.readPullRequestCommitsMethod, AzureDevOpsNames.readPullRequestChangesMethod, AzureDevOpsNames.readPullRequestConflictsMethod,
      "https://dev.azure.com/fabrikam/Web%20Site/_git/site/commit/9fceb02"]);
  });

  it("names its thread reads and writes, and asks the window part's pictures for a person in the pull request's organization and none for a group", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    onTestFinished(() => AzureDevOpsAuthorAvatars.release(context));
    const host: AzureDevOpsPullRequestHost = new AzureDevOpsPullRequestHost(context);
    const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "3f2504e0-4f89-11d3-9a0c-0305e82c3301", 752);

    expect([host.readThreadsMethod, host.replyToThreadMethod, host.changeThreadMethod, host.personAvatarOf(reference, "[Web Site]\\Web Team"),
      host.personAvatarOf(reference, "monalisa@fabrikam.test")]).toEqual([AzureDevOpsNames.readPullRequestThreadsMethod, AzureDevOpsNames.replyToThreadMethod,
      AzureDevOpsNames.changeThreadMethod, null, undefined]);
  });

  it("finds the open repository when its remote is the pull request's, ignoring case and the address's escapes", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal(FOLDER)));
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.answer(GitNames.statusMethod, statusOf("FABRIKAM/web%20site/_git/SITE").toJson());

    expect(await new AzureDevOpsPullRequestHost(context).localFolderAsync(URL)).toBe(FOLDER);
    expect(requests.payloads).toEqual([{ folder: FOLDER }]);
  });
});
