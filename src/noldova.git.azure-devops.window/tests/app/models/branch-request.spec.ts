/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BranchRequest } from "../../../src/app/models/branch-request.ts";
import { Resources } from "../../../src/resources.ts";

describe("BranchRequest", () => {
  it("reads the folder, organization, id and title back from the card action's address", () => {
    const address = Resources.formatBranchActionAddress("fabrikam", 42, "Sign in & out: with a token?");

    expect(BranchRequest.of("/repository", address)).toEqual(new BranchRequest("/repository", "fabrikam", 42, "Sign in & out: with a token?"));
  });

  it("answers null for another address, another action, an organization Azure DevOps doesn't allow, or an id that isn't a whole number from one", () => {
    const addresses = ["https://dev.azure.com/fabrikam/web/_workitems/edit/42", "git-azure-devops:open?organization=fabrikam&id=42",
      "git-azure-devops:branch?id=42", "git-azure-devops:branch?organization=fab%2Frikam&id=42", "git-azure-devops:branch?organization=fabrikam",
      "git-azure-devops:branch?organization=fabrikam&id=0", "git-azure-devops:branch?organization=fabrikam&id=4.2",
      "git-azure-devops:branch?organization=fabrikam&id=9007199254740993"];

    expect(addresses.map(t => BranchRequest.of("/repository", t))).toEqual(addresses.map(() => null));
  });

  it("takes an empty title when the address has none", () => {
    expect(BranchRequest.of("/repository", "git-azure-devops:branch?organization=fabrikam&id=42")?.title).toBe("");
  });

  it("suggests the id and the title in lower case with a dash for every run of other characters, or the id alone for a title with none of its letters", () => {
    const names = [new BranchRequest("/r", "fabrikam", 42, "  Sign in: with a TOKEN!  "), new BranchRequest("/r", "fabrikam", 7, "Привет"),
      new BranchRequest("/r", "fabrikam", 8, "")].map(t => t.suggestedName);

    expect(names).toEqual(["42-sign-in-with-a-token", "7", "8"]);
  });

  it("cuts a title past fifty characters at the last word that fits, and a single longer word at fifty characters", () => {
    const names = [new BranchRequest("/r", "fabrikam", 1, "Make the sign in page remember the organization the person typed last time"),
      new BranchRequest("/r", "fabrikam", 2, `${"a".repeat(50)} x`), new BranchRequest("/r", "fabrikam", 3, `${"a".repeat(49)} b`),
      new BranchRequest("/r", "fabrikam", 4, "a".repeat(60))].map(t => t.suggestedName);

    expect(names).toEqual(["1-make-the-sign-in-page-remember-the-organization", `2-${"a".repeat(50)}`, `3-${"a".repeat(49)}`, `4-${"a".repeat(50)}`]);
  });

  it("puts the suggested name under users and the owner, or gives it alone with no owner", () => {
    const request = new BranchRequest("/r", "fabrikam", 4832, "Tag filter ignores case in note titles");

    expect([request.nameFor("mona-lisa"), request.nameFor(null)]).toEqual(["users/mona-lisa/4832-tag-filter-ignores-case-in-note-titles", "4832-tag-filter-ignores-case-in-note-titles"]);
  });

  it("takes the owner from a login's part before its first @, in lower case with a dash for every run of other characters, or none when nothing is left", () => {
    const owners = ["Mona.Lisa@fabrikam.com", "ana@one@two", "FABRIKAM\\Ana", "--ana--", "Привет@fabrikam.com", "@fabrikam.com"].map(t => BranchRequest.ownerOf(t));

    expect(owners).toEqual(["mona-lisa", "ana", "fabrikam-ana", "ana", null, null]);
  });
});
