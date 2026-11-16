/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostingProtocolException, HostReference } from "../../src/api/index.ts";

describe("HostingFieldException", () => {
  it("names the field by its path and what it should hold", () => {
    const failure = new HostingFieldException("$.reference.number", "a whole number above zero");

    assert.ok(failure instanceof HostingProtocolException);
    assert.equal(failure.name, "HostingFieldException");
    assert.equal(failure.field, "$.reference.number");
    assert.equal(failure.expectation, "a whole number above zero");
    assert.equal(failure.message, "The field $.reference.number is invalid: expected a whole number above zero.");
    assert.equal(failure.cause, undefined);
  });

  it("is what a model's fromJson throws for a field it can't take", () => {
    assert.throws(() => HostReference.fromJson({ host: "git-github", owner: "team", repository: "repo", number: 0 }),
      { name: "HostingFieldException", field: "$.number", expectation: "a whole number above zero" });
  });
});
