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

import { FilterSubmodulesTooManyException } from "../../src/exceptions/filter-submodules-too-many.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";

describe("FilterSubmodulesTooManyException", () => {
  test("carries its codes, message and facts", () => {
    const error = new FilterSubmodulesTooManyException(256);

    assert.equal(error.name, "FilterSubmodulesTooManyException");
    assert.equal(error.message, "The repository has more than 256 checked-out submodules, more than the module checks for filters, so it stops.");
    assert.equal(error.code, FailureCode.Unavailable);
    assert.equal(error.gitCode, null);
    assert.equal(error.limit, 256);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
