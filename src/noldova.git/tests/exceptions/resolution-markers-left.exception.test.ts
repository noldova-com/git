/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode, GitCode } from "@noldova/git.protocol";

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { ResolutionMarkersLeftException } from "../../src/exceptions/resolution-markers-left.exception.ts";

describe("ResolutionMarkersLeftException", () => {
  test("carries its codes and message", () => {
    const error = new ResolutionMarkersLeftException();

    assert.equal(error.name, "ResolutionMarkersLeftException");
    assert.equal(error.message, "The resolved text still has conflict marker lines. Resolve every conflict first. Nothing changed.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.Conflict);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
