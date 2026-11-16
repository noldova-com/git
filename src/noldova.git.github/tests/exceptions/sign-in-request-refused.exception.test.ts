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
import { SignInRequestRefusedException } from "../../src/exceptions/sign-in-request-refused.exception.ts";

describe("SignInRequestRefusedException", () => {
  it("names the address and the status GitHub refused the request with", () => {
    const failure = new SignInRequestRefusedException("https://api.github.com/user", 500);

    assert.ok(failure instanceof SignInRefusedException);
    assert.equal(failure.name, "SignInRequestRefusedException");
    assert.deepEqual([failure.url, failure.status], ["https://api.github.com/user", 500]);
    assert.equal(failure.message, "GitHub refused the sign-in's request to https://api.github.com/user (500).");
    assert.equal(failure.cause, undefined);
  });
});
