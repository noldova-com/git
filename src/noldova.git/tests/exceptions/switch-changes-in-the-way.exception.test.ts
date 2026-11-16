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
import { SwitchChangesInTheWayException } from "../../src/exceptions/switch-changes-in-the-way.exception.ts";

describe("SwitchChangesInTheWayException", () => {
  test("carries its codes, message and facts", () => {
    const paths = Array.from({ length: 11 }, (_, index) => `f${index}.txt`);
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };

    const error = new SwitchChangesInTheWayException(paths, output);

    assert.equal(error.name, "SwitchChangesInTheWayException");
    assert.equal(error.message, "Switching would overwrite your changes to f0.txt, f1.txt, f2.txt, f3.txt, f4.txt, f5.txt, f6.txt, f7.txt, f8.txt, f9.txt and 1 other, so git didn't switch. Commit or stash them first.");
    assert.equal(error.code, FailureCode.Git);
    assert.equal(error.gitCode, GitCode.ChangesInTheWay);
    assert.deepEqual(error.paths, paths);
    assert.deepEqual(error.output, output);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof GitFailureException);
  });
});
