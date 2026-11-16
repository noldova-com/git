/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingArgumentException, HostingProtocolException, HostReference } from "../../src/api/index.ts";

describe("HostingArgumentException", () => {
  it("names the parameter and what it should hold", () => {
    const failure = new HostingArgumentException("number", "a whole number above zero");

    assert.ok(failure instanceof HostingProtocolException);
    assert.equal(failure.name, "HostingArgumentException");
    assert.equal(failure.parameterName, "number");
    assert.equal(failure.expectation, "a whole number above zero");
    assert.equal(failure.message, "The argument number is invalid: expected a whole number above zero.");
    assert.equal(failure.cause, undefined);
  });

  it("is what a model's constructor throws for a part it can't take", () => {
    assert.throws(() => new HostReference("git-github", "team", "repo", 0),
      { name: "HostingArgumentException", parameterName: "number", expectation: "a whole number above zero" });
  });
});
