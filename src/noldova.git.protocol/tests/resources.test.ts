/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { Resources } from "../src/resources.ts";

describe("The protocol's Resources", () => {
  it("hold the expectations and the field names", () => {
    assert.equal(Resources.nonEmptyTextExpected, "a text that isn't empty");
    assert.equal(Resources.objectIdExpected, "a full hexadecimal object id");
    assert.equal(Resources.unknownField, "none, since the model doesn't define it");
    assert.deepEqual([Resources.keyField, Resources.repositoryField, Resources.pathField, Resources.branchField, Resources.baseField], ["key", "repository", "path", "branch", "base"]);
  });

  it("match only a full SHA-1 or SHA-256 object id in lowercase", () => {
    assert.equal(Resources.objectIdPattern.test("a".repeat(40)), true);
    assert.equal(Resources.objectIdPattern.test("b".repeat(64)), true);
    assert.equal(Resources.objectIdPattern.test("a".repeat(39)), false);
    assert.equal(Resources.objectIdPattern.test("A".repeat(40)), false);
  });

  it("hold the expectations of the status and diff models", () => {
    assert.deepEqual([
      Resources.countExpected, Resources.positiveExpected,
      Resources.pathBytesExpected, Resources.modeExpected, Resources.nullExpected, Resources.absentExpected, Resources.upstreamGoneExpected, Resources.originalPathExpected,
      Resources.scopeRevisionExpected, Resources.binaryHunksExpected, Resources.submoduleCommitsExpected, Resources.truncatedExpected,
      Resources.oldPathExpected, Resources.conflictStatesExpected
    ], [
      "a whole number of zero or more", "a whole number above zero",
      "the path's bytes in base64", "a file mode of six octal digits", "null", "no value", "0, since the upstream is gone", "a path exactly when the entry is renamed or copied",
      "a revision exactly when the scope is a range", "no hunks, since the file is binary", "an old or a new commit", "true, since files were left out",
      "the path itself, unless the file is renamed or copied", "Unmodified, since the entry is a conflict"
    ]);
  });

  it("match base64 and a six-digit octal mode only", () => {
    assert.equal(Resources.base64Pattern.test("YS50eHQ="), true);
    assert.equal(Resources.base64Pattern.test("YS50eHQ"), false);
    assert.equal(Resources.modePattern.test("100644"), true);
    assert.equal(Resources.modePattern.test("100648"), false);
  });

  it("hold the expectations and limits of the request models", () => {
    assert.deepEqual([
      Resources.folderExpected, Resources.relativePathExpected, Resources.pathCountExpected, Resources.branchNameExpected, Resources.logLimitExpected
    ], [
      "an absolute path of at most 4096 characters",
      "a relative path of 1 to 4096 characters, not starting with a drive and colon, a colon or a backslash, without a .. segment or a NUL character",
      "1 to 10000 paths",
      "a branch name git accepts: 1 to 255 characters, not - first, not @ or HEAD alone, not . last, without .., @{, a space, a control character or any of ~^:?*[\\, "
        + "and with no segment between slashes that is empty, starts with . or ends with .lock",
      "a whole number from 1 to 500"
    ]);
    assert.deepEqual([Resources.maximumPathLength, Resources.maximumPathCount, Resources.maximumBranchNameLength, Resources.maximumLogLimit], [4096, 10000, 255, 500]);
    assert.deepEqual([Resources.lineCountExpected, Resources.maximumLineCount, Resources.linesField], ["1 to 100000 different lines", 100_000, "lines"]);
    assert.deepEqual([Resources.parentSegment, Resources.nulCharacter, Resources.noNulExpected], ["..", "\u0000", "a text without a NUL character"]);
  });

  it("match an absolute path's start on POSIX and Windows, and split a path on either separator", () => {
    for (const value of ["/a", "C:\\a", "z:/a", "\\\\server\\share"])
      assert.equal(Resources.absolutePathPattern.test(value), true);
    for (const value of ["a", "C:a", "\\a", "./a"])
      assert.equal(Resources.absolutePathPattern.test(value), false);
    assert.deepEqual("a/b\\c".split(Resources.pathSeparatorPattern), ["a", "b", "c"]);
  });

  it("hold the log's fields, its line limit and its date and time form", () => {
    assert.deepEqual([Resources.commitsField, Resources.idField, Resources.parentsField, Resources.authorField, Resources.authoredAtField, Resources.subjectField],
      ["commits", "id", "parents", "author", "authoredAt", "subject"]);
    assert.deepEqual([Resources.worktreesField, Resources.lockedField, Resources.prunableField], ["worktrees", "locked", "prunable"]);
    assert.equal(Resources.hooksField, "hooks");
    assert.equal(Resources.maximumLineLength, 1000);
    assert.deepEqual([Resources.imageField, Resources.maximumAvatarLength, Resources.avatarImageExpected],
      ["image", 90_000, "a PNG, JPEG, GIF or WebP image as a base64 data address of at most 90000 characters, or null"]);
    assert.equal(Resources.lineExpected, "a line of at most 1000 characters without a control character");
    assert.equal(Resources.dateTimeExpected, "an ISO 8601 date and time with its offset, such as 2026-11-06T09:30:00-08:00");
    assert.equal(Resources.commitsExpected, "at most 500 commits");
    assert.deepEqual(["a" + String.fromCharCode(0x1b), "a" + String.fromCharCode(0x85), "a"].map(t => Resources.controlCharacterPattern.test(t)), [true, true, false]);
    assert.deepEqual(["2026-11-06T09:30:00-08:00", "2026-11-06T17:30:00Z", "2026-11-06 09:30:00", "2026-11-06T09:30:00"].map(t => Resources.dateTimePattern.test(t)),
      [true, true, false, false]);
  });

  it("format a field's path and an invalid field's message", () => {
    assert.equal(Resources.formatFieldPath("$.files.0", "path"), "$.files.0.path");
    assert.equal(Resources.formatItemField("branches", 2), "branches.2");
    assert.equal(Resources.formatInvalidField("$.kind", "a text"), "The field $.kind is invalid: expected a text.");
  });
});
