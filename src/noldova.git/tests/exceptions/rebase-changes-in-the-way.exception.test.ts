/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FailureCode, GitCode } from "@noldova/git.protocol";

import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { RebaseChangesInTheWayException } from "../../src/exceptions/rebase-changes-in-the-way.exception.ts";

describe("RebaseChangesInTheWayException", () => {
  test("carries its codes, message and paths, naming the first ten and counting the rest", () => {
    const paths: readonly string[] = Array.from({ length: 12 }, (_, i) => `f${i}.txt`);
    const error = new RebaseChangesInTheWayException(paths);
    const few = new RebaseChangesInTheWayException(["a.txt", "b.txt"]);

    assert.equal(error.name, "RebaseChangesInTheWayException");
    assert.equal(error.message, "You have changes to f0.txt, f1.txt, f2.txt, f3.txt, f4.txt, f5.txt, f6.txt, f7.txt, f8.txt, f9.txt and 2 others, so the rebase didn't start. Commit or stash them first.");
    assert.equal(few.message, "You have changes to a.txt, b.txt, so the rebase didn't start. Commit or stash them first.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.ChangesInTheWay);
    assert.deepEqual(error.paths, paths);
    assert.equal(error.output, null);
    assert.ok(error instanceof GitFailureException);
  });
});
