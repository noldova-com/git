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
import { SignInUnreachableException } from "../../src/exceptions/sign-in-unreachable.exception.ts";

describe("SignInUnreachableException", () => {
  it("names the address it couldn't reach and keeps the network's failure as its cause", () => {
    const cause = new TypeError("fetch failed");

    const failure = new SignInUnreachableException("https://github.com/login/device/code", cause);

    assert.ok(failure instanceof GitHubException);
    assert.equal(failure.name, "SignInUnreachableException");
    assert.equal(failure.url, "https://github.com/login/device/code");
    assert.equal(failure.message, "GitHub couldn't be reached at https://github.com/login/device/code for the sign-in.");
    assert.equal(failure.cause, cause);
  });
});
