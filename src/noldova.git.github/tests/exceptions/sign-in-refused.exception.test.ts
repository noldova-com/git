/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ExceptionOptions } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { GitHubException } from "../../src/exceptions/github.exception.ts";
import { SignInRefusedException } from "../../src/exceptions/sign-in-refused.exception.ts";

class ProbeException extends SignInRefusedException {
  public constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }
}

describe("SignInRefusedException", () => {
  it("is a GitHubException that passes on its subclass's message and cause", () => {
    const cause = new Error("unreadable");

    const failure = new ProbeException("GitHub refused.", new ExceptionOptions(cause));

    assert.ok(failure instanceof GitHubException);
    assert.equal(failure.name, "ProbeException");
    assert.equal(failure.message, "GitHub refused.");
    assert.equal(failure.cause, cause);
  });
});
