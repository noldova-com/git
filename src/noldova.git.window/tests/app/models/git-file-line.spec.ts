/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitFileLine } from "../../../src/app/models/git-file-line.ts";

describe("GitFileLine", () => {
  it("keeps a file's path and the line to show in it", () => {
    const line: GitFileLine = new GitFileLine("src/app.ts", 42);

    expect([line.path, line.line]).toEqual(["src/app.ts", 42]);
  });
});
