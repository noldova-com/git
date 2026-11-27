/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { GitHubUnreachableException } from "../../src/exceptions/github-unreachable.exception.ts";

describe("GitHubUnreachableException", () => {
  it("fails as the code it is given, saying GitHub couldn't be reached", () => {
    const failure = new GitHubUnreachableException(FailureCode.DeadlineExceeded);

    assert.ok(failure instanceof MethodFailureException);
    assert.deepEqual([failure.name, failure.failure.code, failure.failure.message, failure.cause],
      ["GitHubUnreachableException", FailureCode.DeadlineExceeded, "GitHub couldn't be reached.", undefined]);
  });
});
