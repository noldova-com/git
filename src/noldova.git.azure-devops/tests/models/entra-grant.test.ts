/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { EntraGrant } from "../../src/models/entra-grant.ts";

describe("EntraGrant", () => {
  it("holds Microsoft's access and refresh tokens and the seconds the access token lasts, writing code unless it's told the grant can't", () => {
    const grant = new EntraGrant("access-token", "refresh-token", 3_599);
    const readOnly = new EntraGrant("access-token", "refresh-token", 3_599, false);

    assert.deepEqual([grant.accessToken, grant.refreshToken, grant.expiresIn, grant.canWriteCode, readOnly.canWriteCode],
      ["access-token", "refresh-token", 3_599, true, false]);
  });
});
