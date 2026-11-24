/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { CheckState, HostBuild } from "../../src/api/index.ts";

const url: string = "https://dev.azure.com/fabrikam/web/_build/results?buildId=7";
const passed: HostBuild = new HostBuild("web-ci", CheckState.Succeeded, url, 1_800_000_000_000, 1_800_000_060_000);

describe("HostBuild", () => {
  it("takes a finish time exactly for a finished build, and returns itself as JSON that reads back the same", () => {
    assert.deepEqual(passed.toJson(), { name: "web-ci", state: "Succeeded", url, startedAt: 1_800_000_000_000, finishedAt: 1_800_000_060_000, number: null });
    for (const build of [passed, new HostBuild("web-ci", CheckState.Queued, null, null, null), new HostBuild("web-ci", CheckState.Running, null, 1, null),
      new HostBuild("web-ci", CheckState.Failed, null, 5, 5), new HostBuild("web-ci", CheckState.Neutral, null, null, 9)])
      assert.deepEqual(HostBuild.fromJson(build.toJson()), build);
  });

  it("carries the build's number when the host gives one, none by default, and reads JSON without it as none", () => {
    const numbered: HostBuild = new HostBuild("web-ci", CheckState.Running, url, 1_800_000_000_000, null, "20261121.4");
    const { number: _found, ...older } = passed.toJson();

    assert.deepEqual([numbered.number, numbered.toJson()["number"], HostBuild.fromJson(numbered.toJson()), passed.number, HostBuild.fromJson(older).number],
      ["20261121.4", "20261121.4", numbered, null, null]);
  });

  it("refuses a blank number, naming it as the parameter, or by its path in JSON", () => {
    assert.throws(() => new HostBuild("ci", CheckState.Queued, null, null, null, " "), { name: "HostingArgumentException", parameterName: "number" });
    assert.throws(() => HostBuild.fromJson({ ...passed.toJson(), number: "" }, "$.builds.1"), { name: "HostingFieldException", field: "$.builds.1.number" });
  });

  it("refuses a blank name, an address that isn't https and times out of range or order, naming the parameter", () => {
    assert.throws(() => new HostBuild(" ", CheckState.Queued, null, null, null), { name: "HostingArgumentException", parameterName: "name" });
    assert.throws(() => new HostBuild("ci", CheckState.Queued, "ftp://dev.azure.com", null, null), { name: "HostingArgumentException", parameterName: "url" });
    assert.throws(() => new HostBuild("ci", CheckState.Running, null, 0, null), { name: "HostingArgumentException", parameterName: "startedAt" });
    assert.throws(() => new HostBuild("ci", CheckState.Running, null, 1, 2), { name: "HostingArgumentException", parameterName: "finishedAt" });
    assert.throws(() => new HostBuild("ci", CheckState.Succeeded, null, 1, null), { name: "HostingArgumentException", parameterName: "finishedAt" });
    assert.throws(() => new HostBuild("ci", CheckState.Failed, null, null, -1), { name: "HostingArgumentException", parameterName: "finishedAt" });
    assert.throws(() => new HostBuild("ci", CheckState.Failed, null, 10, 9),
      { name: "HostingArgumentException", parameterName: "finishedAt", message: "The argument finishedAt is invalid: expected a finish time exactly when the build has finished, no earlier than its start." });
  });

  it("refuses JSON with a field it doesn't define, out of its range or a state it doesn't know, naming the field by its path", () => {
    assert.throws(() => HostBuild.fromJson({ ...passed.toJson(), id: 7 }), { name: "HostingFieldException", field: "$.id" });
    assert.throws(() => HostBuild.fromJson({ ...passed.toJson(), finishedAt: null }, "$.builds.0"), { name: "HostingFieldException", field: "$.builds.0.finishedAt" });
    assert.throws(() => HostBuild.fromJson({ ...passed.toJson(), state: "Skipped" }), { name: "JsonException", path: "$.state" });
  });
});
