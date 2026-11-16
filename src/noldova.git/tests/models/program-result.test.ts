/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { ProcessExit } from "@noldova/desktop.runtime";

import { ProgramResult } from "../../src/models/program-result.ts";

describe("ProgramResult", () => {
  test("keeps the exit, the output, the errors and whether the output was cut", () => {
    const exit = new ProcessExit(1, null);
    const result = new ProgramResult(exit, Buffer.from("out"), Buffer.from("err"), false);

    assert.equal(result.exit, exit);
    assert.equal(result.output.toString(), "out");
    assert.equal(result.errors.toString(), "err");
    assert.equal(result.isTruncated, false);
  });
});
