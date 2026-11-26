/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode } from "@noldova/git.protocol";

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { SwitchRemoteAmbiguousException } from "../../src/exceptions/switch-remote-ambiguous.exception.ts";

describe("SwitchRemoteAmbiguousException", () => {
  test("carries its codes, message, branch and the remotes that have it", () => {
    const error = new SwitchRemoteAmbiguousException("feature", ["origin", "upstream", "fork"]);

    assert.equal(error.name, "SwitchRemoteAmbiguousException");
    assert.equal(error.message, "The remotes origin, upstream, fork each have a branch named feature, and checkout.defaultRemote names none of them, so git can't tell which one a new branch would track. Set checkout.defaultRemote, or create the branch from the remote branch you want.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.branch, "feature");
    assert.deepEqual(error.remotes, ["origin", "upstream", "fork"]);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
