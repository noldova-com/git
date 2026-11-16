/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import * as api from "../../src/api/index.ts";
import { GitFolderProvidedException } from "../../src/app/exceptions/git-folder-provided.exception.ts";
import { GitWindowException } from "../../src/app/exceptions/git-window.exception.ts";
import { GitFolder } from "../../src/app/services/git-folder.ts";
import { GitHostRows } from "../../src/app/services/git-host-rows.ts";
import { GitWindowPart, windowPart } from "../../src/app/services/git-window-part.ts";

describe("api", () => {
  it("exports the Git module's window part as windowPart", () => {
    expect(api.windowPart).toBeInstanceOf(GitWindowPart);
    expect(api.windowPart.moduleId).toBe("git");
  });

  it("exports the folder provider, the host rows, the provider's exception and the exceptions' base, and nothing else", () => {
    expect(Object.fromEntries(Object.entries(api))).toEqual({ GitFolder, GitFolderProvidedException, GitHostRows, GitWindowException, windowPart });
    expect(new api.GitFolderProvidedException()).toBeInstanceOf(api.GitWindowException);
  });
});
