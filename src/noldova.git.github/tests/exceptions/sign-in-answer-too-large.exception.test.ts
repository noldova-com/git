/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { SignInAnswerTooLargeException } from "../../src/exceptions/sign-in-answer-too-large.exception.ts";
import { SignInRefusedException } from "../../src/exceptions/sign-in-refused.exception.ts";

describe("SignInAnswerTooLargeException", () => {
  it("names the address whose answer was over the sign-in's 64 KiB", () => {
    const failure = new SignInAnswerTooLargeException("https://github.com/login/oauth/access_token");

    assert.ok(failure instanceof SignInRefusedException);
    assert.equal(failure.name, "SignInAnswerTooLargeException");
    assert.equal(failure.url, "https://github.com/login/oauth/access_token");
    assert.equal(failure.message, "GitHub's answer to the sign-in's request to https://github.com/login/oauth/access_token is over 64 KiB, more than the module reads.");
    assert.equal(failure.cause, undefined);
  });
});
