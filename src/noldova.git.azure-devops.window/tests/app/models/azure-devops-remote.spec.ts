/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { AzureDevOpsRemote } from "../../../src/app/models/azure-devops-remote.ts";

const remoteOf = (host: string | null): GitRemote => new GitRemote("origin", host, "fabrikam/web/_git/site", RemoteTransport.Https);

describe("AzureDevOpsRemote", () => {
  it("knows a remote on dev.azure.com, its SSH host, the Visual Studio SSH host or an organization's visualstudio.com host", () => {
    expect(["dev.azure.com", "ssh.dev.azure.com", "vs-ssh.visualstudio.com", "fabrikam.visualstudio.com"].map(t => AzureDevOpsRemote.isAzureDevOps(remoteOf(t))))
      .toEqual([true, true, true, true]);
  });

  it("refuses a remote on another host, one that only ends like visualstudio.com, and one with no host", () => {
    expect(["github.com", "fabrikamvisualstudio.com", "visualstudio.com", null].map(t => AzureDevOpsRemote.isAzureDevOps(remoteOf(t))))
      .toEqual([false, false, false, false]);
  });
});
