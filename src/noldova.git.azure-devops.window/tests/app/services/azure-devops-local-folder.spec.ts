/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitNames, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { GitFolder } from "@noldova/git.window";
import { describe, expect, it, onTestFinished } from "vitest";

import { AzureDevOpsLocalFolder } from "../../../src/app/services/azure-devops-local-folder.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";

const URL: string = "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/482";
const FOLDER: string = "/work/site";
const statusOf = (path: string | null): GitStatus => new GitStatus("main", "a".repeat(40), null, [], false, "f1", null,
  path === null ? null : new GitRemote("origin", "dev.azure.com", path, RemoteTransport.Https));

describe("AzureDevOpsLocalFolder", () => {
  it("finds the open repository when its remote is the pull request's, ignoring case and the address's escapes", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal(FOLDER)));
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.answer(GitNames.statusMethod, statusOf("FABRIKAM/web%20site/_git/SITE").toJson());

    expect(await AzureDevOpsLocalFolder.readAsync(context, URL)).toBe(FOLDER);
    expect([requests.methods, requests.payloads]).toEqual([[GitNames.statusMethod], [{ folder: FOLDER }]]);
  });

  it("finds none with no repository open, or one that isn't the pull request's: another organization, project or name, or no remote", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    const remotes: readonly (string | null)[] = ["contoso/Web%20Site/_git/site", "fabrikam/Mobile/_git/site", "fabrikam/Web%20Site/_git/portal", null];
    requests.answer(GitNames.statusMethod, ...remotes.map(t => statusOf(t).toJson()));

    const found: (string | null)[] = [await AzureDevOpsLocalFolder.readAsync(context, URL)];
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal(FOLDER)));
    found.push(...await Promise.all(remotes.map(() => AzureDevOpsLocalFolder.readAsync(context, URL))));

    expect([found, requests.methods.length]).toEqual([[null, null, null, null, null], 4]);
  });

  it("reads no status for a page address it can't read: a badly escaped project, or a host that isn't Azure DevOps's", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal(FOLDER)));
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);

    const found = [await AzureDevOpsLocalFolder.readAsync(context, "https://dev.azure.com/fabrikam/Web%E0%A4%A/_git/site/pullrequest/482"),
      await AzureDevOpsLocalFolder.readAsync(context, "https://fabrikam.visualstudio.com/Web/_git/site/pullrequest/482")];

    expect([found, requests.methods]).toEqual([[null, null], []]);
  });

  it("finds none for a remote whose repository name is badly escaped", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal(FOLDER)));
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.answer(GitNames.statusMethod, statusOf("fabrikam/Web%20Site/_git/si%E0%A4%A").toJson());

    expect(await AzureDevOpsLocalFolder.readAsync(context, URL)).toBeNull();
  });

  it("logs a repository status the window can't read and finds none, and rethrows a failure that isn't the window's", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal(FOLDER)));
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.fail(GitNames.statusMethod, new WindowFailure("No Git module."));
    const error: RangeError = new RangeError("Unexpected.");
    requests.fail(GitNames.statusMethod, error);

    expect(await AzureDevOpsLocalFolder.readAsync(context, URL)).toBeNull();
    await expect(AzureDevOpsLocalFolder.readAsync(context, URL)).rejects.toBe(error);
    expect(context.callsOf("log").map(t => t[0])).toEqual(["The Azure DevOps module's git.status request failed: WindowFailure: No Git module."]);
  });
});
