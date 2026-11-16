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
import { SignInExpiredException } from "../../src/exceptions/sign-in-expired.exception.ts";

describe("SignInExpiredException", () => {
  it("says the code expired before the person entered it", () => {
    const failure = new SignInExpiredException();

    assert.ok(failure instanceof GitHubException);
    assert.equal(failure.name, "SignInExpiredException");
    assert.equal(failure.message, "The sign-in's code expired before the person entered it at GitHub.");
    assert.equal(failure.cause, undefined);
  });
});
