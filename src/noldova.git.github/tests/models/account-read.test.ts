/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { HostAccount } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { AccountRead } from "../../src/models/account-read.ts";

describe("AccountRead", () => {
  it("holds the account GitHub answered and its avatar's address, or none", () => {
    const account = new HostAccount("octocat", null, null, ["repo"]);

    const reads = [new AccountRead(account, "https://avatars.githubusercontent.com/u/583231"), new AccountRead(account, null)];

    assert.deepEqual(reads.map(t => [t.account, t.avatarUrl]), [[account, "https://avatars.githubusercontent.com/u/583231"], [account, null]]);
  });
});
