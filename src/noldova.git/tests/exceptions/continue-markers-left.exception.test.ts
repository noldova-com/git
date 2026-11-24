/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode, GitCode, UntrustedSource } from "@noldova/git.protocol";

import { ContinueMarkersLeftException } from "../../src/exceptions/continue-markers-left.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("ContinueMarkersLeftException", () => {
  test("carries its codes, message and the marker lines as untrusted output", () => {
    const output = { text: "a.txt:3: leftover conflict marker", source: UntrustedSource.Repository };
    const error = new ContinueMarkersLeftException(output);

    assert.equal(error.name, "ContinueMarkersLeftException");
    assert.equal(error.message, "A file still has conflict marker lines, staged or not. Fix them before continuing; the files come with the failure as untrusted text.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.Conflict);
    assert.equal(error.output, output);
    assert.ok(error instanceof GitFailureException);
  });
});
