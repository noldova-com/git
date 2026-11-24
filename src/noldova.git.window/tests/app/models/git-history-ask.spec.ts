/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitHistoryAsk } from "../../../src/app/models/git-history-ask.ts";

describe("GitHistoryAsk", () => {
  it("holds the repository's folder and the commit another page asked its history to select", () => {
    const ask = new GitHistoryAsk("/work/portal-web", "a91c40e".padEnd(40, "0"));

    expect([ask.folder, ask.commitId]).toEqual(["/work/portal-web", "a91c40e".padEnd(40, "0")]);
  });
});
