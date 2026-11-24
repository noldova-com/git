/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostReference, WorkItemQuery } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { AzureDevOpsReferenceLink } from "../../../src/app/models/azure-devops-reference-link.ts";

describe("AzureDevOpsReferenceLink", () => {
  it("holds what a link asks for, its key and the project a work item's link names", () => {
    const link = new AzureDevOpsReferenceLink(new WorkItemQuery("git-azure-devops", "fabrikam", 42), "fabrikam#42", "Web Site");

    expect([link.query, link.key, link.project]).toEqual([new WorkItemQuery("git-azure-devops", "fabrikam", 42), "fabrikam#42", "Web Site"]);
  });

  it("names no project when it is given none, as for a pull request's link", () => {
    const reference = new HostReference("git-azure-devops", "fabrikam", "3f2504e0-4f89-11d3-9a0c-0305e82c3301", 7);

    expect(new AzureDevOpsReferenceLink(reference, "fabrikam/web!7").project).toBeNull();
  });
});
