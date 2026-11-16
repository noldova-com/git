/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { Resources } from "../src/resources.ts";

describe("The GitHub protocol's Resources", () => {
  it("hold the access service's member and format the address that manages the app's access", () => {
    assert.equal(Resources.accessMember, "access");
    assert.equal(Resources.formatManageAccessUrl("Iv1.a1"), "https://github.com/settings/connections/applications/Iv1.a1");
  });
});
