/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { CheckoutRisks } from "../../src/models/checkout-risks.ts";

describe("CheckoutRisks", () => {
  test("carries the hooks and the filters a checkout would run", () => {
    assert.deepEqual({ ...new CheckoutRisks(["post-checkout"], ["lfs"]) }, { hooks: ["post-checkout"], filters: ["lfs"] });
  });
});
