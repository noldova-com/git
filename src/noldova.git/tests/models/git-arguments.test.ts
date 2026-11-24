/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { GitArguments } from "../../src/models/git-arguments.ts";

describe("GitArguments", () => {
  test("revisions follow --end-of-options and paths follow --, so neither reads as an option", () => {
    const command = new GitArguments(["log", "-z"]);

    const log = command.withRevisions(["--output=/tmp/x"]).withPaths(["-p"]);

    assert.deepEqual(log.values, ["log", "-z", "--end-of-options", "--output=/tmp/x", "--", "-p"]);
    assert.deepEqual(command.values, ["log", "-z"]);
  });

  test("revisions and paths keep their places whatever order they are added in, and an empty list adds no marker", () => {
    const show = new GitArguments(["show"]).withPaths(["a.txt"]).withRevisions(["HEAD"]).withRevisions(["main"]).withPaths(["b.txt"]);

    assert.deepEqual(show.values, ["show", "--end-of-options", "HEAD", "main", "--", "a.txt", "b.txt"]);
    assert.deepEqual(show.options, ["show"]);
    assert.deepEqual(new GitArguments(["status"]).withRevisions([]).withPaths([]).values, ["status"]);
  });

  test("settings come before the command, and keep the revisions and paths in their places", () => {
    const status = new GitArguments(["status"], ["HEAD"], ["a.txt"]).withSettings(["-c", "filter.evil.clean="]);

    assert.deepEqual(status.values, ["-c", "filter.evil.clean=", "status", "--end-of-options", "HEAD", "--", "a.txt"]);
  });

  test("literal paths carry pathspec magic, and the options and revisions stay as they were", () => {
    const add = new GitArguments(["add"], ["HEAD"], ["[ab].txt", ":/x"]).withLiteralPaths();

    assert.deepEqual(add.values, ["add", "--end-of-options", "HEAD", "--", ":(literal)[ab].txt", ":(literal):/x"]);
  });
});
