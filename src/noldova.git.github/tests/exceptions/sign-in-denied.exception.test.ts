/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitHubException } from "../../src/exceptions/github.exception.ts";
import { SignInDeniedException } from "../../src/exceptions/sign-in-denied.exception.ts";

describe("SignInDeniedException", () => {
  it("says the person denied the sign-in", () => {
    const failure = new SignInDeniedException();

    assert.ok(failure instanceof GitHubException);
    assert.equal(failure.name, "SignInDeniedException");
    assert.equal(failure.message, "The person denied the sign-in at GitHub.");
    assert.equal(failure.cause, undefined);
  });
});
