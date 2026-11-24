/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from "vitest";

import type { GitHistoryAsk } from "../../../src/app/models/git-history-ask.ts";
import { GitHistoryAsks } from "../../../src/app/services/git-history-asks.ts";

const portal: string = "/work/portal-web";
const api: string = "/work/portal-api";

describe("GitHistoryAsks", () => {
  afterEach(() => {
    for (const folder of [portal, api]) {
      const left: GitHistoryAsk | null = GitHistoryAsks.askedOf(folder);
      if (left !== null)
        GitHistoryAsks.take(left);
    }
  });

  it("keeps the commit asked of a folder's history for that folder only, and nothing before any ask", () => {
    const before: GitHistoryAsk | null = GitHistoryAsks.askedOf(portal);

    GitHistoryAsks.ask(portal, "a91c40e");

    expect([before, GitHistoryAsks.askedOf(portal)?.commitId, GitHistoryAsks.askedOf(api)]).toEqual([null, "a91c40e", null]);
  });

  it("keeps only the last ask, so a newer one for another folder replaces it", () => {
    GitHistoryAsks.ask(portal, "a91c40e");
    GitHistoryAsks.ask(api, "5f02b7d");

    expect([GitHistoryAsks.askedOf(portal), GitHistoryAsks.askedOf(api)?.commitId]).toEqual([null, "5f02b7d"]);
  });

  it("lets go of an ask once its history takes it, but not of a newer one that replaced it", () => {
    GitHistoryAsks.ask(portal, "a91c40e");
    const first: GitHistoryAsk | null = GitHistoryAsks.askedOf(portal);
    GitHistoryAsks.ask(portal, "5f02b7d");
    if (first !== null)
      GitHistoryAsks.take(first);
    const kept: string | undefined = GitHistoryAsks.askedOf(portal)?.commitId;
    const second: GitHistoryAsk | null = GitHistoryAsks.askedOf(portal);
    if (second !== null)
      GitHistoryAsks.take(second);

    expect([first?.commitId, kept, GitHistoryAsks.askedOf(portal)]).toEqual(["a91c40e", "5f02b7d", null]);
  });
});
