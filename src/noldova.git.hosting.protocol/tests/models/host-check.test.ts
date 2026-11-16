/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { CheckState, HostCheck, HostingArgumentException } from "../../src/api/index.ts";

const build: HostCheck = new HostCheck("build", CheckState.Succeeded, "https://github.com/octocat/hello-world/actions/runs/1");
const lint: HostCheck = new HostCheck("lint", CheckState.Running, null);

function check(state: CheckState): HostCheck {
  return new HostCheck(state, state, null);
}

describe("HostCheck", () => {
  it("takes each check state and no address, and returns itself as JSON that reads back the same", () => {
    const states: readonly CheckState[] = [CheckState.Queued, CheckState.Running, CheckState.Succeeded, CheckState.Failed, CheckState.Neutral];

    assert.deepEqual(states.map(t => HostCheck.fromJson(check(t).toJson()).state), states);
    assert.deepEqual(HostCheck.fromJson(build.toJson()), build);
    assert.deepEqual(HostCheck.fromJson(lint.toJson()), lint);
  });

  it("refuses a blank name and an address that isn't https or names a user, naming the parameter", () => {
    assert.throws(() => new HostCheck(" ", CheckState.Queued, null), HostingArgumentException);
    assert.throws(() => new HostCheck(" ", CheckState.Queued, null), { name: "HostingArgumentException", parameterName: "name" });
    assert.throws(() => new HostCheck("build", CheckState.Queued, "http://github.com/octocat/hello-world/actions/runs/1"), { name: "HostingArgumentException", parameterName: "url" });
    assert.throws(() => new HostCheck("build", CheckState.Queued, "https://hubot@github.com/octocat/hello-world/actions/runs/1"), { name: "HostingArgumentException", parameterName: "url" });
  });

  it("refuses JSON with a field it doesn't define, out of its range or a state it doesn't know, naming the field by its path", () => {
    assert.throws(() => HostCheck.fromJson({ ...build.toJson(), conclusion: "success" }), { name: "HostingFieldException", field: "$.conclusion" });
    assert.throws(() => HostCheck.fromJson({ ...build.toJson(), url: "runs/1" }, "$.checks.0"), { name: "HostingFieldException", field: "$.checks.0.url" });
    assert.throws(() => HostCheck.fromJson({ ...build.toJson(), state: "Skipped" }), { name: "JsonException", path: "$.state" });
  });
});
