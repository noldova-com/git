/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitTextAround } from "../../../src/app/models/git-text-around.ts";

describe("GitTextAround", () => {
  it("holds the words before what links, what links, and the words after it", () => {
    const value: GitTextAround = new GitTextAround("Review ", "!8", " now");

    expect([value.before, value.linked, value.after]).toEqual(["Review ", "!8", " now"]);
  });
});
