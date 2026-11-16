/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode } from "@noldova/git.protocol";

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { PushNoRemoteException } from "../../src/exceptions/push-no-remote.exception.ts";

describe("PushNoRemoteException", () => {
  test("carries its codes and message", () => {
    const error = new PushNoRemoteException();

    assert.equal(error.name, "PushNoRemoteException");
    assert.equal(error.message, "The branch has no remote to push to: it names none, and the repository has none or several.");
    assert.equal(error.code, FailureCode.Refused);
    assert.equal(error.gitCode, null);
    assert.equal(error.output, null);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
