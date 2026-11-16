/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { SignInExpiryInvalidException } from "../../src/exceptions/sign-in-expiry-invalid.exception.ts";
import { SignInRefusedException } from "../../src/exceptions/sign-in-refused.exception.ts";

describe("SignInExpiryInvalidException", () => {
  it("names the expiry GitHub gave and the range it must fall in", () => {
    const failure = new SignInExpiryInvalidException(3_601);

    assert.ok(failure instanceof SignInRefusedException);
    assert.equal(failure.name, "SignInExpiryInvalidException");
    assert.equal(failure.seconds, 3_601);
    assert.equal(failure.message, "GitHub named a sign-in code that expires in 3601 seconds, outside 1 to 3600.");
    assert.equal(failure.cause, undefined);
  });
});
