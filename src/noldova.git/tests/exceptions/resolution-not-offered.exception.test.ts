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
import { ResolutionNotOfferedException } from "../../src/exceptions/resolution-not-offered.exception.ts";

describe("ResolutionNotOfferedException", () => {
  test("carries its codes and message", () => {
    const error = new ResolutionNotOfferedException();

    assert.equal(error.name, "ResolutionNotOfferedException");
    assert.equal(error.message, "That choice isn't offered for this kind of conflict. Nothing changed.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
