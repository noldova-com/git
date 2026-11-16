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
import { SignInNotKeptException } from "../../src/exceptions/sign-in-not-kept.exception.ts";

describe("SignInNotKeptException", () => {
  it("says the token couldn't be kept and keeps the secrets' failure as its cause", () => {
    const cause = new Error("The secrets are locked.");

    const failure = new SignInNotKeptException(cause);

    assert.ok(failure instanceof GitHubException);
    assert.equal(failure.name, "SignInNotKeptException");
    assert.equal(failure.message, "The GitHub token couldn't be kept in this computer's secrets.");
    assert.equal(failure.cause, cause);
  });
});
