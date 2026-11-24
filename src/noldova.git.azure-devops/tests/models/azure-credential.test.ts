/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { AzureCredential } from "../../src/models/azure-credential.ts";

describe("AzureCredential", () => {
  it("sends a personal access token as basic authorization with no user name, and a Microsoft access token as a bearer token", () => {
    assert.deepEqual([AzureCredential.ofToken("azure-token").authorization, AzureCredential.ofAccess("access-token").authorization],
      [`Basic ${Buffer.from(":azure-token").toString("base64")}`, "Bearer access-token"]);
  });

  it("stays the same credential when a refresh renews its access token", () => {
    const credential = AzureCredential.ofAccess("first-access");
    const held = credential;

    credential.renew("second-access", true);

    assert.deepEqual([held === credential, held.authorization, held.canWriteCode], [true, "Bearer second-access", true]);
  });

  it("can write code until a renewal comes without that scope, and again once one comes with it", () => {
    const credential = AzureCredential.ofAccess("first-access");
    const states: boolean[] = [credential.canWriteCode, AzureCredential.ofToken("azure-token").canWriteCode];

    credential.renew("second-access", false);
    states.push(credential.canWriteCode);
    credential.renew("third-access", true);
    states.push(credential.canWriteCode);

    assert.deepEqual(states, [true, true, false, true]);
  });
});
