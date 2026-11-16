/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { SignInErrorException } from "../../src/exceptions/sign-in-error.exception.ts";
import { SignInRefusedException } from "../../src/exceptions/sign-in-refused.exception.ts";

describe("SignInErrorException", () => {
  it("names the error GitHub ended the sign-in with", () => {
    const failure = new SignInErrorException("incorrect_client_credentials");

    assert.ok(failure instanceof SignInRefusedException);
    assert.equal(failure.name, "SignInErrorException");
    assert.equal(failure.error, "incorrect_client_credentials");
    assert.equal(failure.message, "GitHub ended the sign-in with the error incorrect_client_credentials.");
    assert.equal(failure.cause, undefined);
  });
});
