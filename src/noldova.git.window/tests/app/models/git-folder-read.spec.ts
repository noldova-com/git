/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitFolderRead } from "../../../src/app/models/git-folder-read.ts";

describe("GitFolderRead", () => {
  it("keeps the folder it read, or the failure that stopped the read", () => {
    const read: GitFolderRead = new GitFolderRead("/work/repo", null);
    const failed: GitFolderRead = new GitFolderRead(null, "The folder is gone.");

    expect([read.folder, read.failure, failed.folder, failed.failure]).toEqual(["/work/repo", null, null, "The folder is gone."]);
  });
});
