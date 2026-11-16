/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { Access } from "../../src/enums/access.ts";
import { Program } from "../../src/enums/program.ts";
import { FolderNotAbsoluteException } from "../../src/exceptions/folder-not-absolute.exception.ts";
import { GitArguments } from "../../src/models/git-arguments.ts";
import { ProgramLimits } from "../../src/models/program-limits.ts";
import { ProgramRun } from "../../src/models/program-run.ts";

describe("ProgramRun", () => {
  const limits = new ProgramLimits(1, 1);
  const notAbsolute = (error: unknown, message: string, label: string, folder: string): boolean =>
    error instanceof FolderNotAbsoluteException && error.message === message && error.label === label && error.folder === folder;

  test("a git read names no git folder, so it never waits for a write", () => {
    const run = ProgramRun.readGit(new GitArguments(["status"]), "/work", limits);

    assert.equal(run.program, Program.Git);
    assert.equal(run.access, Access.Read);
    assert.deepEqual(run.arguments, ["status"]);
    assert.equal(run.workingFolder, "/work");
    assert.equal(run.gitFolder, null);
    assert.equal(run.commonGitFolder, null);
    assert.equal(run.limits, limits);
    assert.equal(run.signal, undefined);
  });

  test("a git write names its git folder and its common git folder", () => {
    const signal = new AbortController().signal;

    const run = ProgramRun.writeGit(new GitArguments(["add"]), "/work", "/repository/.git/worktrees/work", "/repository/.git", limits, signal);

    assert.equal(run.access, Access.Write);
    assert.equal(run.gitFolder, "/repository/.git/worktrees/work");
    assert.equal(run.commonGitFolder, "/repository/.git");
    assert.equal(run.signal, signal);
  });

  test("a gh run keeps its access and names no git folder", () => {
    const run = ProgramRun.runGh(Access.Write, ["pr", "create"], "/work", limits);

    assert.equal(run.program, Program.Gh);
    assert.equal(run.access, Access.Write);
    assert.deepEqual(run.arguments, ["pr", "create"]);
    assert.equal(run.commonGitFolder, null);
  });

  test("a working folder or a git folder that isn't absolute is refused", () => {
    assert.throws(() => ProgramRun.readGit(new GitArguments(["status"]), "work", limits), (error: unknown) => notAbsolute(error, "The working folder must be an absolute path.", "working folder", "work"));
    assert.throws(() => ProgramRun.writeGit(new GitArguments(["add"]), "/work", ".git", "/work/.git", limits), (error: unknown) => notAbsolute(error, "The git folder must be an absolute path.", "git folder", ".git"));
    assert.throws(() => ProgramRun.writeGit(new GitArguments(["add"]), "/work", "/work/.git", ".git", limits), (error: unknown) => notAbsolute(error, "The common git folder must be an absolute path.", "common git folder", ".git"));
    assert.throws(() => ProgramRun.runGh(Access.Read, ["pr", "view"], "", limits), (error: unknown) => notAbsolute(error, "The working folder must be an absolute path.", "working folder", ""));
  });
});
