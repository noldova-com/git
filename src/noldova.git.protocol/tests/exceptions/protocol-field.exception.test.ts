/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ProtocolFieldException } from "../../src/exceptions/protocol-field.exception.ts";
import { ProtocolException } from "../../src/exceptions/protocol.exception.ts";

describe("ProtocolFieldException", () => {
  it("names the field and what it should hold, and carries no code", () => {
    const failure = new ProtocolFieldException("$.base", "a full hexadecimal object id");

    assert.ok(failure instanceof ProtocolException);
    assert.equal(failure.name, "ProtocolFieldException");
    assert.equal(failure.field, "$.base");
    assert.equal(failure.expectation, "a full hexadecimal object id");
    assert.equal(failure.message, "The field $.base is invalid: expected a full hexadecimal object id.");
    assert.equal(failure.cause, undefined);
    assert.equal("code" in failure, false);
  });
});
