/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitCommand } from "../../src/models/git-command.ts";
import type { IFieldFailure } from "../fixtures/field-failure.fixture.ts";

const expected = (field: string, expectation: string): IFieldFailure =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitCommand", () => {
  const at = "2026-11-06T09:30:00-08:00";
  const json = { id: "7", at, line: "git commit -m x", exitCode: 0, milliseconds: 125 };

  it("keeps its id, start, command line, exit code and time, and reads back the same, with or without an exit code", () => {
    const command = new GitCommand("7", at, "git commit -m x", 0, 125);
    const unfinished = new GitCommand("8", "2026-11-06T17:30:00Z", "git fetch", null, 0);

    assert.deepEqual(command.toJson(), json);
    assert.deepEqual(unfinished.toJson(), { id: "8", at: "2026-11-06T17:30:00Z", line: "git fetch", exitCode: null, milliseconds: 0 });
    assert.deepEqual(GitCommand.fromJson(JSON.parse(JSON.stringify(command.toJson()))), command);
    assert.deepEqual(GitCommand.fromJson(JSON.parse(JSON.stringify(unfinished.toJson()))), unfinished);
    assert.equal(new GitCommand("9", at, "git push", -1, 1).exitCode, -1);
  });

  it("refuses an empty or multi-line id and command line, naming its path", () => {
    assert.throws(() => new GitCommand("", at, "git fetch", 0, 1), expected("id", "a text that isn't empty"));
    assert.throws(() => GitCommand.fromJson({ ...json, id: "7\n" }), expected("$.id", "a line of at most 1000 characters without a control character"));
    assert.throws(() => GitCommand.fromJson({ ...json, line: "" }), expected("$.line", "a text that isn't empty"));
    assert.throws(() => GitCommand.fromJson({ ...json, line: "git\tfetch" }), expected("$.line", "a line of at most 1000 characters without a control character"));
    assert.throws(() => new GitCommand("7", at, "x".repeat(1001), 0, 1), expected("line", "a line of at most 1000 characters without a control character"));
    assert.equal(new GitCommand("7", at, "x".repeat(1000), 0, 1).line.length, 1000);
  });

  it("refuses a start without its offset or that isn't a date, a fractional exit code and a negative or fractional time", () => {
    const dateTime = "an ISO 8601 date and time with its offset, such as 2026-11-06T09:30:00-08:00";

    assert.throws(() => GitCommand.fromJson({ ...json, at: "2026-11-06T09:30:00" }), expected("$.at", dateTime));
    assert.throws(() => new GitCommand("7", "2026-13-01T00:00:00Z", "git fetch", 0, 1), expected("at", dateTime));
    assert.throws(() => new GitCommand("7", at, "git fetch", 1.5, 1), expected("exitCode", "a whole number, or null when the command ended without one"));
    assert.throws(() => GitCommand.fromJson({ ...json, milliseconds: -1 }), expected("$.milliseconds", "a whole number of zero or more"));
    assert.throws(() => new GitCommand("7", at, "git fetch", 0, 0.5), expected("milliseconds", "a whole number of zero or more"));
  });

  it("refuses a missing exit code and a field it doesn't define", () => {
    const { exitCode: _exitCode, ...missing } = json;

    assert.throws(() => GitCommand.fromJson(missing), { name: "JsonException", path: "$.exitCode" });
    assert.throws(() => GitCommand.fromJson({ ...json, more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
