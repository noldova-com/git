/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitBulkTarget } from "../../../src/app/models/git-bulk-target.ts";

describe("GitBulkTarget", () => {
  it("keeps a repository's folder, name, branch, upstream and remote", () => {
    const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/site", RemoteTransport.Https);
    const target: GitBulkTarget = new GitBulkTarget("/work/site", "site", "main", "origin/main", remote);

    expect([target.folder, target.repository, target.branch, target.upstream, target.remote]).toEqual(["/work/site", "site", "main", "origin/main", remote]);
  });

  it("keeps a branch with no upstream on a repository with no remote", () => {
    const target: GitBulkTarget = new GitBulkTarget("/work/notes", "notes", "draft", null, null);

    expect([target.upstream, target.remote]).toEqual([null, null]);
  });
});
