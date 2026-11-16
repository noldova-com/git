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
import { UnsafeRepositoryException } from "../../src/exceptions/unsafe-repository.exception.ts";

describe("UnsafeRepositoryException", () => {
  test("carries its codes, message and facts", () => {
    const output = { text: "fatal: detected dubious ownership", source: UntrustedSource.Repository };
    const error = new UnsafeRepositoryException("/tmp/a", output);

    assert.equal(error.name, "UnsafeRepositoryException");
    assert.equal(error.message, "Git refuses the repository at /tmp/a, since another user owns it. If you trust it, add it to safe.directory in your git configuration; the module never does.");
    assert.equal(error.code, FailureCode.NotRepository);
    assert.equal(error.gitCode, GitCode.UnsafeRepository);
    assert.equal(error.folder, "/tmp/a");
    assert.equal(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
