/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitCommentsLink } from "../../../src/app/models/git-comments-link.ts";

describe("GitCommentsLink", () => {
  it("holds the row's text and the page it opens", () => {
    const value: GitCommentsLink = new GitCommentsLink("2 comments", "https://example.com/c/1");

    expect([value.text, value.url]).toEqual(["2 comments", "https://example.com/c/1"]);
  });
});
