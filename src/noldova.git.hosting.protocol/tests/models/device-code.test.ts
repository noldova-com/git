/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { DeviceCode } from "../../src/api/index.ts";

describe("DeviceCode", () => {
  it("refuses a blank code, a page that isn't https or names a user, and an expiry that isn't a whole number above zero", () => {
    assert.throws(() => new DeviceCode(" ", "https://github.com/login/device", 1), { name: "HostingArgumentException", parameterName: "userCode", message: "The argument userCode is invalid: expected a text that isn't blank." });
    assert.throws(() => new DeviceCode("WDJB-MJHT", "http://github.com/login/device", 1), { name: "HostingArgumentException", parameterName: "verificationUri", message: "The argument verificationUri is invalid: expected an https address with no user name or password." });
    assert.throws(() => new DeviceCode("WDJB-MJHT", "https://user:secret@github.com/login/device", 1), { name: "HostingArgumentException", parameterName: "verificationUri" });
    assert.throws(() => new DeviceCode("WDJB-MJHT", "https://user@github.com/login/device", 1), { name: "HostingArgumentException", parameterName: "verificationUri" });
    assert.throws(() => DeviceCode.fromJson({ userCode: "WDJB-MJHT", verificationUri: "https://:secret@github.com/login/device", expiresAt: 1 }), { name: "HostingFieldException", field: "$.verificationUri" });
    assert.throws(() => new DeviceCode("WDJB-MJHT", "github.com/login/device", 1), { name: "HostingArgumentException", parameterName: "verificationUri" });
    assert.throws(() => new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 0), { name: "HostingArgumentException", parameterName: "expiresAt", message: "The argument expiresAt is invalid: expected a whole number above zero." });
    assert.throws(() => DeviceCode.fromJson({ userCode: "WDJB-MJHT", verificationUri: "https://github.com/login/device", expiresAt: 1.5 }, "$.deviceCode"), { name: "JsonException", path: "$.deviceCode.expiresAt" });
  });
});
