/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import "@noldova/context.core";
import { describe, test } from "vitest";

import { UnreadableOutputException } from "../../src/exceptions/unreadable-output.exception.ts";
import { Required } from "../../src/models/required.ts";

describe("Required", () => {
  test("gives the item at an index that holds one", () => {
    assert.equal(Required.at(["a", "b"], 1, "log", "commits"), "b");
  });

  test("fails as unreadable output of the command when the index holds nothing", () => {
    const match = /(a)|(b)/v.exec("a");
    assert.ok(!Object.isNull(match));

    assert.throws(() => Required.at(match, 2, "log", "commits"), (error: unknown) =>
      error instanceof UnreadableOutputException && error.name === "UnreadableOutputException" && error.command === "log" && error.part === "commits");
  });

  test("gives a chunk of bytes as it is", () => {
    const bytes = Buffer.from("output");

    assert.equal(Required.bytes(bytes, "git", "output"), bytes);
  });

  test("fails as unreadable output of the program when a chunk is text, not bytes", () => {
    assert.throws(() => Required.bytes("output", "git", "output"), (error: unknown) =>
      error instanceof UnreadableOutputException && error.command === "git" && error.part === "output");
  });
});
