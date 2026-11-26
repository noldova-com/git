/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { afterEach, describe, expect, it } from "vitest";

import type { GitHistoryAsk } from "../../../src/app/models/git-history-ask.ts";
import { GitHistoryAsks } from "../../../src/app/services/git-history-asks.ts";

const garden: string = "/work/garden-web";
const api: string = "/work/garden-api";

describe("GitHistoryAsks", () => {
  afterEach(() => {
    for (const folder of [garden, api]) {
      const left: GitHistoryAsk | null = GitHistoryAsks.askedOf(folder);
      if (!Object.isNull(left))
        GitHistoryAsks.take(left);
    }
  });

  it("keeps the commit asked of a folder's history for that folder only, and nothing before any ask", () => {
    const before: GitHistoryAsk | null = GitHistoryAsks.askedOf(garden);

    GitHistoryAsks.ask(garden, "a91c40e");

    expect([before, GitHistoryAsks.askedOf(garden)?.commitId, GitHistoryAsks.askedOf(api)]).toEqual([null, "a91c40e", null]);
  });

  it("keeps only the last ask, so a newer one for another folder replaces it", () => {
    GitHistoryAsks.ask(garden, "a91c40e");
    GitHistoryAsks.ask(api, "5f02b7d");

    expect([GitHistoryAsks.askedOf(garden), GitHistoryAsks.askedOf(api)?.commitId]).toEqual([null, "5f02b7d"]);
  });

  it("lets go of an ask once its history takes it, but not of a newer one that replaced it", () => {
    GitHistoryAsks.ask(garden, "a91c40e");
    const first: GitHistoryAsk | null = GitHistoryAsks.askedOf(garden);
    GitHistoryAsks.ask(garden, "5f02b7d");
    if (!Object.isNull(first))
      GitHistoryAsks.take(first);
    const kept: string | undefined = GitHistoryAsks.askedOf(garden)?.commitId;
    const second: GitHistoryAsk | null = GitHistoryAsks.askedOf(garden);
    if (!Object.isNull(second))
      GitHistoryAsks.take(second);

    expect([first?.commitId, kept, GitHistoryAsks.askedOf(garden)]).toEqual(["a91c40e", "5f02b7d", null]);
  });
});
