/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonException } from "@noldova/context.json";
import { describe, it } from "vitest";

import { AzureRepository } from "../../src/models/azure-repository.ts";
import { BranchLink } from "../../src/models/branch-link.ts";

function repositoryOf(path: string): AzureRepository {
  const repository = AzureRepository.parse("dev.azure.com", path);
  if (repository === null)
    throw new Error(`${path} isn't an Azure DevOps repository.`);
  return repository;
}

describe("BranchLink", () => {
  it("reads the remote's repository, the work item's id and the branch, from either host form", () => {
    const links = [BranchLink.fromJson({ host: "dev.azure.com", path: "fabrikam/Web Site/_git/site", id: 42, branch: "42-sign-in" }),
      BranchLink.fromJson({ host: "fabrikam.visualstudio.com", path: "DefaultCollection/Web Site/_git/site", id: 42, branch: "42-sign-in" })];

    for (const link of links)
      assert.deepEqual(link, new BranchLink(repositoryOf("fabrikam/Web Site/_git/site"), 42, "42-sign-in"));
  });

  it("answers null for a remote that isn't Azure DevOps', an id below one or a branch name longer than Git keeps", () => {
    const remote = { host: "dev.azure.com", path: "fabrikam/web/_git/site" };

    assert.deepEqual([BranchLink.fromJson({ host: "github.com", path: "octocat/hello-world", id: 42, branch: "main" }),
      BranchLink.fromJson({ ...remote, id: 0, branch: "main" }), BranchLink.fromJson({ ...remote, id: 42, branch: "b".repeat(251) })], [null, null, null]);
    assert.ok(BranchLink.fromJson({ ...remote, id: 42, branch: "b".repeat(250) }) !== null);
  });

  it("refuses a payload without a host, a whole id or a branch name that isn't blank", () => {
    const remote = { host: "dev.azure.com", path: "fabrikam/web/_git/site" };

    for (const value of [null, { path: remote.path, id: 42, branch: "main" }, { ...remote, id: 4.2, branch: "main" }, { ...remote, id: 42, branch: " " }])
      assert.throws(() => BranchLink.fromJson(value), JsonException);
  });
});
