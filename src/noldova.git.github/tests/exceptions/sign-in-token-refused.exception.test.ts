/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { SignInRefusedException } from "../../src/exceptions/sign-in-refused.exception.ts";
import { SignInTokenRefusedException } from "../../src/exceptions/sign-in-token-refused.exception.ts";

describe("SignInTokenRefusedException", () => {
  it("says GitHub didn't accept the token it had just granted", () => {
    const failure = new SignInTokenRefusedException();

    assert.ok(failure instanceof SignInRefusedException);
    assert.equal(failure.name, "SignInTokenRefusedException");
    assert.equal(failure.message, "GitHub didn't accept the token it had just granted.");
    assert.equal(failure.cause, undefined);
  });
});
