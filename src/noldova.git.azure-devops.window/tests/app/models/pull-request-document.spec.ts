/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostReference } from "@noldova/git.hosting.protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PullRequestDocument } from "../../../src/app/models/pull-request-document.ts";

const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("PullRequestDocument", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names a pull request's document by its organization, repository and number, and reads the reference back", () => {
    const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 752);

    const instance: string = PullRequestDocument.instanceOf(reference);

    expect([instance, PullRequestDocument.referenceOf(instance)]).toEqual([`fabrikam/${REPOSITORY}/752`, reference]);
  });

  it("reads no reference from an instance with a missing part, a number that isn't one or more, or a name the protocol refuses", () => {
    expect(["fabrikam/752", `fabrikam/${REPOSITORY}/0`, `fabrikam/${REPOSITORY}/x`, `fabrikam/${REPOSITORY}/752/1`, `fabrikam/a b/752`, ""]
      .map(t => PullRequestDocument.referenceOf(t))).toEqual([null, null, null, null, null, null]);
  });

  it("rethrows a failure that isn't the protocol's while it reads a reference", () => {
    vi.spyOn(Number, "isSafeInteger").mockImplementation(() => {
      throw new RangeError("Unexpected.");
    });

    expect(() => PullRequestDocument.referenceOf(`fabrikam/${REPOSITORY}/752`)).toThrow(RangeError);
  });
});
