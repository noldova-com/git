/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode, GitCode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { RebaseStoppedException } from "../../src/exceptions/rebase-stopped.exception.ts";

describe("RebaseStoppedException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: git said no", source: UntrustedSource.Repository };
    const error = new RebaseStoppedException(output);

    assert.equal(error.name, "RebaseStoppedException");
    assert.equal(error.message, "The rebase stopped on conflicts. Resolve them, stage the files and continue, or abort.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.Conflict);
    assert.deepEqual(error.output, output);
    assert.ok(error instanceof GitFailureException);
  });
});
