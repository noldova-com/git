/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import "@noldova/context.core";
import { describe, it } from "vitest";

import { AzureRepository } from "../../src/models/azure-repository.ts";

function partsOf(host: string, path: string): readonly string[] | null {
  const repository: AzureRepository | null = AzureRepository.parse(host, path);
  return Object.isNull(repository) ? null : [repository.organization, repository.project, repository.name];
}

interface IRemote {
  readonly host: string;
  readonly path: string;
}

describe("AzureRepository", () => {
  it("reads the organization, project and repository from each kind of Azure DevOps remote", () => {
    assert.deepEqual([
      partsOf("dev.azure.com", "fabrikam/web/_git/site"),
      partsOf("ssh.dev.azure.com", "v3/fabrikam/web/site"),
      partsOf("vs-ssh.visualstudio.com", "v3/fabrikam/web/site"),
      partsOf("fabrikam.visualstudio.com", "web/_git/site"),
      partsOf("fabrikam.visualstudio.com", "DefaultCollection/web/_git/site")
    ], [["fabrikam", "web", "site"], ["fabrikam", "web", "site"], ["fabrikam", "web", "site"], ["fabrikam", "web", "site"], ["fabrikam", "web", "site"]]);
  });

  it("decodes a project and repository name the path carries in percent escapes, such as a space, and reads none whose escapes don't decode", () => {
    assert.deepEqual([
      partsOf("dev.azure.com", "fabrikam/Sample%20Project/_git/Web%20Site"),
      partsOf("ssh.dev.azure.com", "v3/fabrikam/Sample%20Project/site"),
      partsOf("dev.azure.com", "fabrikam/Sample Project/_git/site"),
      partsOf("dev.azure.com", "fabrikam/Sample%2/_git/site"),
      partsOf("dev.azure.com", "fabrikam/web/_git/site%E0")
    ], [["fabrikam", "Sample Project", "Web Site"], ["fabrikam", "Sample Project", "site"], ["fabrikam", "Sample Project", "site"], null, null]);
  });

  it("reads no repository from another host, a path of another shape or an organization that isn't a name", () => {
    const remotes: readonly IRemote[] = [{ host: "github.com", path: "octocat/hello-world" }, { host: "dev.azure.com", path: "fabrikam/web/site" },
      { host: "dev.azure.com", path: "fabrikam/web/_git/site/extra" }, { host: "ssh.dev.azure.com", path: "v2/fabrikam/web/site" }, { host: "vs-ssh.visualstudio.com", path: "fabrikam/web/_git/site" },
      { host: "fabrikam.visualstudio.com", path: "Collection/web/_git/site" }, { host: "dev.azure.com", path: "-fabrikam/web/_git/site" }, { host: "fab_rikam.visualstudio.com", path: "web/_git/site" }];

    assert.deepEqual(remotes.map(({ host, path }) => partsOf(host, path)), remotes.map(() => null));
  });
});
