/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { DeviceCode } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { DeviceGrant } from "../../src/models/device-grant.ts";

describe("DeviceGrant", () => {
  it("holds the device code, the code the person enters, how long it lasts and the poll interval", () => {
    const code = new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_900_000);

    const grant = new DeviceGrant("3584d83530557fdd1f46af8289938c8ef79f9dc5", code, 900_000, 5_000);

    assert.deepEqual([grant.deviceCode, grant.code, grant.expiresIn, grant.interval], ["3584d83530557fdd1f46af8289938c8ef79f9dc5", code, 900_000, 5_000]);
  });
});
