/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException, ServiceMissingException } from "@noldova/desktop.runtime";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, it } from "vitest";

import { GitHubFolderUsers } from "../../src/services/github-folder-users.ts";
import { FakeToken } from "../fixtures/fake-github.fixture.ts";
import { FakeRepositories, statusOf } from "../fixtures/fake-tools.fixture.ts";

const FOLDER: string = "/home/monalisa/hello-world";
const signal: AbortSignal = new AbortController().signal;

class Rig {
  public readonly repositories: FakeRepositories = new FakeRepositories();
  public readonly tokens: FakeToken = new FakeToken();
  public readonly users: GitHubFolderUsers = new GitHubFolderUsers(this.tokens, () => this.repositories);
}

describe("GitHubFolderUsers", () => {
  it("gives the accounts the user name in a folder's remote when the remote is the repository asked for, in any case and with or without .git", async () => {
    const rig = new Rig();
    rig.repositories.users.set("origin", "hubot");
    rig.repositories.remotes.set("upstream", new GitRemote("upstream", "GitHub.com", "Octocat/Hello-World", RemoteTransport.Https));

    await rig.users.useAsync(FOLDER, "origin", "github.com", "octocat/hello-world", signal);
    await rig.users.useAsync(FOLDER, "upstream", "github.com", "octocat/hello-world.git", signal);

    assert.deepEqual(rig.tokens.users, ["github.com octocat/hello-world.git hubot", "GitHub.com Octocat/Hello-World null"]);
    assert.deepEqual([rig.repositories.remoteReads, rig.repositories.userReads], [[[FOLDER, "origin"], [FOLDER, "upstream"]], [[FOLDER, "origin"], [FOLDER, "upstream"]]]);
  });

  it("gives nothing, and reads no user name, for a folder whose remote is on another host, another path, has no host or path, or is missing", async () => {
    const rig = new Rig();
    rig.repositories.users.set("origin", "hubot");
    rig.repositories.remotes.set("local", new GitRemote("local", null, "srv/hello-world.git", RemoteTransport.File));
    rig.repositories.remotes.set("bare", new GitRemote("bare", "github.com", null, RemoteTransport.Https));

    await rig.users.useAsync(FOLDER, "origin", "ghe.example.com", "octocat/hello-world", signal);
    await rig.users.useAsync(FOLDER, "origin", "github.com", "octocat/other", signal);
    await rig.users.useAsync(FOLDER, "local", "github.com", "octocat/hello-world", signal);
    await rig.users.useAsync(FOLDER, "bare", "github.com", "octocat/hello-world", signal);
    rig.repositories.answer = statusOf("fix-bug", null, null);
    await rig.users.useAsync(FOLDER, "origin", "github.com", "octocat/hello-world", signal);

    assert.deepEqual([rig.tokens.users, rig.repositories.userReads, rig.repositories.remoteReads.length], [[], [], 5]);
  });

  it("gives nothing for a folder Git can't read or while the Git module isn't active, and passes on any other failure to reach it or to read the remote", async () => {
    const unexpected = new RangeError("Unexpected.");
    const tokens = new FakeToken();
    const missing = new GitHubFolderUsers(tokens, () => {
      throw new ServiceMissingException("git.repositories");
    });
    const broken = new GitHubFolderUsers(tokens, () => {
      throw unexpected;
    });
    const unreadable = new Rig();
    unreadable.repositories.answer = new MethodFailureException(new Failure(FailureCode.NotFound, "The folder isn't a Git repository."));
    const failing = new Rig();
    failing.repositories.answer = unexpected;

    await missing.useAsync(FOLDER, "origin", "github.com", "octocat/hello-world", signal);
    await unreadable.users.useAsync(FOLDER, "origin", "github.com", "octocat/hello-world", signal);
    await assert.rejects(broken.useAsync(FOLDER, "origin", "github.com", "octocat/hello-world", signal), unexpected);
    await assert.rejects(failing.users.useAsync(FOLDER, "origin", "github.com", "octocat/hello-world", signal), unexpected);

    assert.deepEqual([tokens.users, unreadable.tokens.users, failing.tokens.users], [[], [], []]);
  });
});
