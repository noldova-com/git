/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { SubmoduleStatus } from "../../src/models/submodule-status.ts";

describe("SubmoduleStatus", () => {
  it("keeps its fields and returns them as JSON that reads back the same", () => {
    const submodule = new SubmoduleStatus(true, false, true);

    assert.deepEqual(submodule.toJson(), { commitChanged: true, trackedChanges: false, untrackedChanges: true });
    assert.deepEqual(SubmoduleStatus.fromJson(JSON.parse(JSON.stringify(submodule.toJson()))), submodule);
  });

  it("refuses a field that isn't a boolean and a field it doesn't define", () => {
    assert.throws(() => SubmoduleStatus.fromJson({ commitChanged: "yes", trackedChanges: false, untrackedChanges: false }), { name: "JsonException", path: "$.commitChanged" });
    assert.throws(() => SubmoduleStatus.fromJson({ commitChanged: true, trackedChanges: false, untrackedChanges: false, path: "lib" }), { name: "ProtocolFieldException", field: "$.path" });
  });
});
