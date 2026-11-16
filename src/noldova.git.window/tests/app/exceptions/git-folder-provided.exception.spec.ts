/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitFolderProvidedException } from "../../../src/app/exceptions/git-folder-provided.exception.ts";

describe("GitFolderProvidedException", () => {
  it("says to unregister the first provider, with no cause", () => {
    const exception: GitFolderProvidedException = new GitFolderProvidedException();

    expect([exception.message, exception.cause])
      .toEqual(["This window already has a Git folder provider; unregister it before providing another.", undefined]);
  });
});
