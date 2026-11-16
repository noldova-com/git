/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { GitHubException } from "../../src/exceptions/github.exception.ts";

class ProbeException extends GitHubException {
  public constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }
}

describe("GitHubException", () => {
  it("is the package's base, with its subclass's name, its message and its cause", () => {
    const cause = new Error("unreadable");

    const failure = new ProbeException("GitHub broke a rule.", new ExceptionOptions(cause));

    assert.ok(failure instanceof Exception);
    assert.equal(failure.name, "ProbeException");
    assert.equal(failure.message, "GitHub broke a rule.");
    assert.equal(failure.cause, cause);
  });
});
