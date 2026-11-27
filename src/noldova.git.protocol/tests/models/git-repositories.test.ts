/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { RemoteTransport } from "../../src/enums/remote-transport.ts";
import { GitRemote } from "../../src/models/git-remote.ts";
import { GitRepositories } from "../../src/models/git-repositories.ts";
import { GitStatus } from "../../src/models/git-status.ts";

class ProbeRepositories extends GitRepositories {
  public readonly asked: string[] = [];

  public override async readStatusAsync(folder: string, _signal: AbortSignal): Promise<GitStatus> {
    this.asked.push(folder);
    return await Promise.resolve(new GitStatus("main", null, null, [], false, "f0", null, null));
  }

  public override async readRemoteAsync(folder: string, name: string, _signal: AbortSignal): Promise<GitRemote | null> {
    this.asked.push(`${folder} ${name}`);
    return await Promise.resolve(name === "origin" ? new GitRemote("origin", "host.example", "team/repo", RemoteTransport.Https) : null);
  }
}

describe("GitRepositories", () => {
  it("is the reads a module takes from the local Git module, answered by the subclass the app gives it", async () => {
    const repositories: GitRepositories = new ProbeRepositories();
    const signal = new AbortController().signal;

    const status = await repositories.readStatusAsync("/work/repo", signal);
    const origin = await repositories.readRemoteAsync("/work/repo", "origin", signal);
    const missing = await repositories.readRemoteAsync("/work/repo", "backup", signal);

    assert.ok(repositories instanceof ProbeRepositories);
    assert.deepEqual([status.branch, origin?.path, missing, repositories.asked], ["main", "team/repo", null, ["/work/repo", "/work/repo origin", "/work/repo backup"]]);
  });
});
