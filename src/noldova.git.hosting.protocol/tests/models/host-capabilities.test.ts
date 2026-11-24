/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostCapabilities, HostCapability } from "../../src/api/index.ts";

const capabilities: HostCapabilities = new HostCapabilities([HostCapability.SignIn, HostCapability.Votes]);

describe("HostCapabilities", () => {
  it("tells which capabilities a host has, and returns itself as JSON that reads back the same", () => {
    assert.equal(capabilities.has(HostCapability.Votes), true);
    assert.equal(capabilities.has(HostCapability.Pipelines), false);
    assert.deepEqual(capabilities.toJson(), { capabilities: ["SignIn", "Votes"] });
    assert.deepEqual(HostCapabilities.fromJson(capabilities.toJson()), capabilities);
    assert.deepEqual(HostCapabilities.fromJson({ capabilities: [] }).capabilities, []);
  });

  it("keeps its own copy of the list it was given", () => {
    const given: HostCapability[] = [HostCapability.Builds];
    const kept: HostCapabilities = new HostCapabilities(given);

    given.push(HostCapability.Checks);

    assert.deepEqual(kept.capabilities, [HostCapability.Builds]);
  });

  it("refuses a capability named twice, naming the parameter", () => {
    assert.throws(() => new HostCapabilities([HostCapability.SignIn, HostCapability.SignIn]),
      { name: "HostingArgumentException", parameterName: "capabilities", message: "The argument capabilities is invalid: expected each capability at most once." });
  });

  it("refuses JSON with a field it doesn't define, a capability it doesn't know or one named twice, naming the field by its path", () => {
    assert.throws(() => HostCapabilities.fromJson({ capabilities: [], extra: true }), { name: "HostingFieldException", field: "$.extra" });
    assert.throws(() => HostCapabilities.fromJson({ capabilities: ["Teleport"] }, "$.host"), { name: "HostingFieldException", field: "$.host.capabilities" });
    assert.throws(() => HostCapabilities.fromJson({ capabilities: ["Votes", "Votes"] }), { name: "HostingFieldException", field: "$.capabilities" });
    assert.throws(() => HostCapabilities.fromJson({ capabilities: [1] }), { name: "JsonException" });
  });
});
