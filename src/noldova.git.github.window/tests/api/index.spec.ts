/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { windowPart } from "../../src/api/index.ts";
import { GitHubWindowPart } from "../../src/app/services/github-window-part.ts";

describe("api", () => {
  it("exports the GitHub module's window part as windowPart", () => {
    expect(windowPart).toBeInstanceOf(GitHubWindowPart);
    expect(windowPart.moduleId).toBe("git-github");
  });
});
