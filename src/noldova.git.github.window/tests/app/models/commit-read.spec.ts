/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { CommitQuery } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { CommitRead } from "../../../src/app/models/commit-read.ts";

describe("CommitRead", () => {
  it("holds a commit read's folder, remote, query and the answer it fills", () => {
    const remote = new GitRemote("origin", "github.com", "octocat/site", RemoteTransport.Https);
    const query = new CommitQuery("github.com", "octocat/site", "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678");
    const answer = signal<string | null>(null);
    const read = new CommitRead("D:/site", remote, query, answer);

    expect([read.folder, read.remote, read.query, read.answer]).toEqual(["D:/site", remote, query, answer]);
  });
});
