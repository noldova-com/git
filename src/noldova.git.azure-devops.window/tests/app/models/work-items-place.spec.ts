/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { WorkItemsPlace } from "../../../src/app/models/work-items-place.ts";

function remote(host: string | null, path: string | null): GitRemote {
  return new GitRemote("origin", host, path, RemoteTransport.Https);
}

describe("WorkItemsPlace", () => {
  it("reads an organization and project, with or without a work item, from a document's instance and writes it back", () => {
    const project: WorkItemsPlace | null = WorkItemsPlace.ofInstance("fabrikam/Sample%20Project");
    const item: WorkItemsPlace | null = WorkItemsPlace.ofInstance("fabrikam/Sample%20Project/7521");

    expect(project).toEqual(new WorkItemsPlace("fabrikam", "Sample Project", null));
    expect(item).toEqual(new WorkItemsPlace("fabrikam", "Sample Project", 7521));
    expect([project?.instance, item?.instance]).toEqual(["fabrikam/Sample%20Project", "fabrikam/Sample%20Project/7521"]);
  });

  it("reads no place from an empty instance, a bad organization, a blank or badly escaped project, or an id that isn't above zero", () => {
    const instances: readonly string[] = ["", "fabrikam", "-fabrikam/web", "fabrikam/%20", "fabrikam/%E0%A4%A", "fabrikam/web/0", "fabrikam/web/x",
      "fabrikam/web/1/2"];

    expect(instances.map(t => WorkItemsPlace.ofInstance(t))).toEqual(instances.map(() => null));
  });

  it("reads the organization and project of a remote on each Azure DevOps host", () => {
    const remotes: readonly GitRemote[] = [remote("dev.azure.com", "fabrikam/Sample%20Project/_git/garden-web"),
      remote("ssh.dev.azure.com", "v3/fabrikam/Sample%20Project/garden-web"), remote("vs-ssh.visualstudio.com", "v3/fabrikam/Sample%20Project/garden-web"),
      remote("fabrikam.visualstudio.com", "Sample%20Project/_git/garden-web"), remote("fabrikam.visualstudio.com", "DefaultCollection/Sample%20Project/_git/garden-web")];

    expect(remotes.map(t => WorkItemsPlace.ofRemote(t))).toEqual(remotes.map(() => new WorkItemsPlace("fabrikam", "Sample Project", null)));
  });

  it("reads the organization and project of a page's address, and no place from an address that names no project", () => {
    expect(["https://dev.azure.com/fabrikam/Sample%20Project/_git/garden-web/pullrequest/7", "https://dev.azure.com/fabrikam/_workitems/edit/3"]
      .map(t => WorkItemsPlace.ofPage(t))).toEqual([new WorkItemsPlace("fabrikam", "Sample Project", null), null]);
  });

  it("reads no place without a remote, from another host's remote, or from a remote whose project isn't readable", () => {
    const remotes: readonly (GitRemote | null)[] = [null, remote("github.com", "fabrikam/garden-web"), remote(null, null),
      remote("dev.azure.com", "fabrikam/%E0%A4%A/_git/garden-web")];

    expect(remotes.map(t => WorkItemsPlace.ofRemote(t))).toEqual(remotes.map(() => null));
  });

  it("passes on an error that isn't a bad escape", () => {
    const original = globalThis.decodeURIComponent;
    globalThis.decodeURIComponent = () => {
      throw new RangeError("broken");
    };
    try {
      expect(() => WorkItemsPlace.ofInstance("fabrikam/web")).toThrow(RangeError);
    }
    finally {
      globalThis.decodeURIComponent = original;
    }
  });
});
