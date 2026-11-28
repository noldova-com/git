/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RepositoryQuery } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { ListRead } from "../../../src/app/models/list-read.ts";

describe("ListRead", () => {
  it("holds a pull request list read's folder, remote and query", () => {
    const remote = new GitRemote("origin", "github.com", "octocat/site", RemoteTransport.Https);
    const query = new RepositoryQuery("github.com", "octocat/site");
    const read = new ListRead("D:/site", remote, query);

    expect([read.folder, read.remote, read.query]).toEqual(["D:/site", remote, query]);
  });
});
