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

import { FilterNotSwitchableException } from "../../src/exceptions/filter-not-switchable.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("FilterNotSwitchableException", () => {
  test("carries its codes and message", () => {
    const error = new FilterNotSwitchableException();

    assert.equal(error.name, "FilterNotSwitchableException");
    assert.equal(error.message, "The repository's configuration names a filter whose name the module can't switch off, so it doesn't read the folder.");
    assert.equal(error.code, FailureCode.Unavailable);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
