/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitResolvedFile } from "../../../src/app/models/git-resolved-file.ts";

describe("GitResolvedFile", () => {
  it("holds a resolved file's path and how it was resolved", () => {
    const value: GitResolvedFile = new GitResolvedFile("src/a.ts", "Took theirs");

    expect([value.path, value.note]).toEqual(["src/a.ts", "Took theirs"]);
  });
});
