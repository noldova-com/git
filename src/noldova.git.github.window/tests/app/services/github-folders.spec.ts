/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitHubNames } from "@noldova/git.github.protocol";
import { FolderQuery, RepositoryAccount } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitHubFolders } from "../../../src/app/services/github-folders.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";

const FOLDER: string = "/work/site";
const origin: GitRemote = new GitRemote("origin", "github.com", "octocat/site", RemoteTransport.Https);

describe("GitHubFolders", () => {
  it("asks the main process to use a folder's remote once while it is in use, sharing one ask, and again for another folder, remote name, host or path", async () => {
    const context = new FakeWindowPartContext();
    const requests = new RequestAnswers(context);
    requests.always(GitHubNames.useFolderMethod, new RepositoryAccount(1).toJson());
    const moved = new GitRemote("origin", "github.com", "octocat/docs", RemoteTransport.Https);
    const upstream = new GitRemote("upstream", "github.com", "octocat/site", RemoteTransport.Https);
    const elsewhere = new GitRemote("origin", "github.example.com", "octocat/site", RemoteTransport.Https);

    const first = GitHubFolders.useAsync(context, FOLDER, origin);
    const shared = GitHubFolders.useAsync(context, FOLDER, origin);
    await Promise.all([first, shared, GitHubFolders.useAsync(context, "/work/docs", origin), GitHubFolders.useAsync(context, FOLDER, moved),
      GitHubFolders.useAsync(context, FOLDER, upstream), GitHubFolders.useAsync(context, FOLDER, elsewhere)]);
    await GitHubFolders.useAsync(context, FOLDER, origin);

    expect([first === shared, requests.methods.length]).toEqual([true, 5]);
    expect(requests.payloads).toEqual([new FolderQuery(FOLDER, "origin").toJson(), new FolderQuery("/work/docs", "origin").toJson(),
      new FolderQuery(FOLDER, "origin").toJson(), new FolderQuery(FOLDER, "upstream").toJson(), new FolderQuery(FOLDER, "origin").toJson()]);
  });

  it("logs a use the window failed and asks again next time, and passes on a failure that isn't the window's, also asking again next time", async () => {
    const context = new FakeWindowPartContext();
    const requests = new RequestAnswers(context);
    const unexpected = new TypeError("Unexpected.");
    requests.fail(GitHubNames.useFolderMethod, new WindowFailure("The runtime stopped."));
    requests.fail(GitHubNames.useFolderMethod, unexpected);
    requests.answer(GitHubNames.useFolderMethod, new RepositoryAccount(null).toJson());

    await GitHubFolders.useAsync(context, FOLDER, origin);
    const rejected = await GitHubFolders.useAsync(context, FOLDER, origin).then(() => null, (error: unknown) => error);
    await GitHubFolders.useAsync(context, FOLDER, origin);
    await GitHubFolders.useAsync(context, FOLDER, origin);

    expect([rejected, requests.methods.length]).toEqual([unexpected, 3]);
    expect(context.callsOf("log").map(t => String(t[0]))).toEqual([
      `The GitHub module's ${GitHubNames.useFolderMethod} request failed: WindowFailure: The runtime stopped.`]);
  });

  it("asks again once it forgets a window's uses, and keeps each window's apart", async () => {
    const context = new FakeWindowPartContext();
    const other = new FakeWindowPartContext();
    const requests = new RequestAnswers(context);
    const otherRequests = new RequestAnswers(other);
    requests.always(GitHubNames.useFolderMethod, new RepositoryAccount(null).toJson());
    otherRequests.always(GitHubNames.useFolderMethod, new RepositoryAccount(null).toJson());

    await GitHubFolders.useAsync(context, FOLDER, origin);
    await GitHubFolders.useAsync(other, FOLDER, origin);
    GitHubFolders.forget(context);
    await GitHubFolders.useAsync(context, FOLDER, origin);
    await GitHubFolders.useAsync(other, FOLDER, origin);

    expect([requests.methods.length, otherRequests.methods.length]).toEqual([2, 1]);
  });
});
