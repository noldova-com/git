/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonException } from "@noldova/context.json";
import { describe, it } from "vitest";

import { SignInAnswerUnreadableException } from "../../src/exceptions/sign-in-answer-unreadable.exception.ts";
import { SignInRefusedException } from "../../src/exceptions/sign-in-refused.exception.ts";

describe("SignInAnswerUnreadableException", () => {
  it("says GitHub's answer couldn't be read and keeps the reader's failure as its cause", () => {
    const cause = new JsonException("The field is missing.", "$.device_code");

    const failure = new SignInAnswerUnreadableException(cause);

    assert.ok(failure instanceof SignInRefusedException);
    assert.equal(failure.name, "SignInAnswerUnreadableException");
    assert.equal(failure.message, "GitHub's answer to the sign-in couldn't be read.");
    assert.equal(failure.cause, cause);
  });
});
