/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { FailureCode, GitRepositoryScan, ScanEnd } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import type { GitFolderLook } from "../../../src/app/models/git-folder-look.ts";
import { GitFolderLooks } from "../../../src/app/services/git-folder-looks.ts";
import { GitRuntimeClient } from "../../../src/app/services/git-runtime-client.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../fixtures/git-held-requests.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";

describe("GitFolderLooks", () => {
  const folder: string = "/work/group";
  const found = new GitRepositoryScan(ScanEnd.Complete, ["/work/group/api"]).toJson();

  class Looking {
    public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
    public readonly held: GitHeldRequests = new GitHeldRequests(this.context, ["git.scanRepositories"]);
    public readonly client: GitRuntimeClient = new GitRuntimeClient(this.context);
    public readonly offered: string[] = [];
    public readonly reported: unknown[] = [];

    public offerAs(name: string): (scan: GitRepositoryScan) => void {
      return scan => this.offered.push(`${name} ${scan.repositories.join(",")}`);
    }

    public join(offer: (scan: GitRepositoryScan) => void): GitFolderLook {
      return GitFolderLooks.join(folder, this.client, offer, error => this.reported.push(error));
    }

    public get scans(): number {
      return this.context.callsOf("requestAsync").filter(t => t[0] === "git.scanRepositories").length;
    }
  }

  it("looks once for a folder however many join, and offers the answer only to the one that joined last", async () => {
    const looking: Looking = new Looking();
    const first = looking.offerAs("first");
    const second = looking.offerAs("second");
    const look: GitFolderLook = looking.join(first);
    const again: GitFolderLook = looking.join(second);
    const before: string = look.text();
    await looking.held.answerAsync("git.scanRepositories", found);
    await Wait.until(() => look.text() !== before);
    GitFolderLooks.leave(look, first);
    GitFolderLooks.leave(again, second);

    expect([look === again, looking.scans, looking.offered, before, look.text()]).toEqual([true, 1, ["second /work/group/api"],
      "This folder, /work/group, isn't inside a Git repository. Looking for repositories under it…",
      "This folder, /work/group, isn't inside a Git repository. Choose from the repositories under it."]);
  });

  it("offers nothing once everyone has left before the answer, and looks again for the next to join, the old answer touching only the old look", async () => {
    const looking: Looking = new Looking();
    const gone = looking.offerAs("gone");
    const back = looking.offerAs("back");
    const old: GitFolderLook = looking.join(gone);
    GitFolderLooks.leave(old, gone);
    const look: GitFolderLook = looking.join(back);
    await looking.held.answerAsync("git.scanRepositories", found);
    await Wait.until(() => !old.text().endsWith("…"));
    const offeredAfterOld: readonly string[] = [...looking.offered];
    await looking.held.answerAsync("git.scanRepositories", new GitRepositoryScan(ScanEnd.Complete, []).toJson());
    await Wait.until(() => !look.text().endsWith("…"));
    GitFolderLooks.leave(look, back);

    expect([old === look, looking.scans, offeredAfterOld, looking.offered, look.text()]).toEqual([false, 2, [], [],
      "This folder, /work/group, isn't inside a Git repository, and no folder under it holds one. Open a folder inside a repository, or run git init here to make one."]);
  });

  it("says a failed look plainly, with how to open a repository, and reports the failure", async () => {
    const looking: Looking = new Looking();
    const offer = looking.offerAs("one");
    const look: GitFolderLook = looking.join(offer);
    await looking.held.answerAsync("git.scanRepositories", GitFixtures.failure(FailureCode.Git, null, "It broke."));
    await Wait.until(() => !look.text().endsWith("…"));
    GitFolderLooks.leave(look, offer);

    expect([look.text(), looking.reported.length, looking.offered]).toEqual([
      "This folder, /work/group, isn't inside a Git repository. Open a folder inside a repository, or use Add repository on the Dashboard to look for the ones under it.", 1, []]);
  });
});
