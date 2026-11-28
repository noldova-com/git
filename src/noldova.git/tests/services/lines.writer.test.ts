/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { FailureCode, GitNames, UndoMode } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { IndexLockedException } from "../../src/exceptions/index-locked.exception.ts";
import { LinesRefusedException } from "../../src/exceptions/lines-refused.exception.ts";
import type { ProgramResult } from "../../src/models/program-result.ts";
import type { ProgramRun } from "../../src/models/program-run.ts";
import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { LinesWriter } from "../../src/services/lines.writer.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("LinesWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let repositories: RepositoryReader;
  let statuses: StatusReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new ProgramRunner(supervisor.context);
    repositories = new RepositoryReader(runner, new GitVersionReader(runner));
    statuses = new StatusReader(runner);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const writeAsync = async (file: string, lines: readonly number[], staged: boolean): Promise<void> => {
    const folders = await repositories.readAsync(repository.folder);
    await new LinesWriter(runner, new FilterOptionsReader(runner), file, lines, staged).runAsync(folders, await statuses.readAsync(folders));
  };
  const indexAsync = async (file: string = "a.txt"): Promise<string> => await repository.runGitAsync(["show", `:${file}`]);
  const commitAsync = async (file: string, content: string): Promise<void> => {
    await repository.writeAsync(file, content);
    await repository.runGitAsync(["add", "--", file]);
    await repository.runGitAsync(["commit", "--quiet", "-m", `Add ${file}`]);
  };
  const failed = (command: string) => (error: unknown): boolean =>
    error instanceof GitFailedException && error.command === command && !Object.isNull(error.output) && error.output.text.length > 0;
  class BreakingRunner extends ProgramRunner {
    private readonly breaks: (run: ProgramRun) => boolean;
    private broken: boolean = false;

    public constructor(breaks: (run: ProgramRun) => boolean) {
      super(supervisor.context);
      this.breaks = breaks;
    }

    public override async runAsync(run: ProgramRun): Promise<ProgramResult> {
      if (!this.broken && this.breaks(run)) {
        this.broken = true;
        await writeFile(path.join(repository.gitFolder, "index"), "broken");
      }
      return await super.runAsync(run);
    }
  }
  const refused = (message: string) => (error: unknown): boolean =>
    error instanceof LinesRefusedException && error.code === FailureCode.Refused && Object.isNull(error.gitCode) && Object.isNull(error.output) && error.message === message;
  const unsupported = refused("Lines can be staged or unstaged only in a changed text file that keeps its name and mode. Stage or unstage the whole file. Nothing changed.");
  const notChosen = refused("None of the chosen lines is an added or removed line of that file's changes, so nothing changed. Choose the lines again.");

  test("names its method by direction, undoes the index, never refuses up front and never asks: only the person's click makes one", async () => {
    const stage = new LinesWriter(runner, new FilterOptionsReader(runner), "a.txt", [0], false);
    const unstage = new LinesWriter(runner, new FilterOptionsReader(runner), "a.txt", [0], true);

    stage.refuse();

    assert.deepEqual([stage.method, unstage.method, stage.undo, unstage.undo, await stage.requestAsync()],
      [GitNames.stageLinesMethod, GitNames.unstageLinesMethod, UndoMode.Index, UndoMode.Index, null]);
  });

  test("stages a chosen added line, keeps an unchosen removed line as context and drops an unchosen added one, leaving the working folder as it is", async () => {
    await repository.writeAsync("a.txt", "b\nc\n");

    await writeAsync("a.txt", [1], false);

    assert.deepEqual([await indexAsync(), await readFile(path.join(repository.folder, "a.txt"), "utf8")], ["a\nb\n", "b\nc\n"]);
  });

  test("stages a chosen removed line alone", async () => {
    await repository.writeAsync("a.txt", "b\nc\n");

    await writeAsync("a.txt", [0], false);

    assert.equal(await indexAsync(), "");
  });

  test("stages lines of the second hunk only, counting lines across hunks, and leaves a hunk with no chosen change out", async () => {
    const numbers: readonly string[] = Array.from({ length: 20 }, (_, index) => `${index + 1}\n`);
    await commitAsync("long.txt", numbers.join(""));
    await repository.writeAsync("long.txt", ["one\n", ...numbers.slice(1, 19), "twenty\n"].join(""));

    await writeAsync("long.txt", [8, 9], false);

    assert.equal(await indexAsync("long.txt"), [...numbers.slice(0, 19), "twenty\n"].join(""));
  });

  test("unstages a chosen added line, keeping an unchosen staged added line staged and an unchosen removed one removed", async () => {
    await repository.writeAsync("a.txt", "b\nc\n");
    await repository.runGitAsync(["add", "a.txt"]);

    await writeAsync("a.txt", [2], true);

    assert.deepEqual([await indexAsync(), await readFile(path.join(repository.folder, "a.txt"), "utf8")], ["b\n", "b\nc\n"]);
  });

  test("unstages a chosen removed line, putting it back in the index", async () => {
    await repository.writeAsync("a.txt", "b\n");
    await repository.runGitAsync(["add", "a.txt"]);

    await writeAsync("a.txt", [0], true);

    assert.equal(await indexAsync(), "a\nb\n");
  });

  test("keeps git's no-newline mark after a kept line and drops it after a dropped one", async () => {
    await repository.writeAsync("a.txt", "a\nb");

    await writeAsync("a.txt", [1], false);
    assert.equal(await indexAsync(), "a\nb");

    await repository.runGitAsync(["reset", "--quiet"]);
    await repository.writeAsync("a.txt", "x");
    await writeAsync("a.txt", [0], false);
    assert.equal(await indexAsync(), "");
  });

  test("keeps a file's own bytes, such as carriage returns", async () => {
    await commitAsync("crlf.txt", "a\r\n");
    await repository.writeAsync("crlf.txt", "a\r\nb\r\nc\r\n");

    await writeAsync("crlf.txt", [2], false);

    assert.equal(await indexAsync("crlf.txt"), "a\r\nc\r\n");
  });

  test("names a path git quotes, with spaces and letters outside ASCII, as git does", async () => {
    await commitAsync("é x.txt", "a\n");
    await repository.writeAsync("é x.txt", "a\nb\n");

    await writeAsync("é x.txt", [1], false);

    assert.equal(await indexAsync("é x.txt"), "a\nb\n");
  });

  test("refuses a file with no changes, a binary file, a renamed file and a changed mode before git applies anything", async () => {
    await assert.rejects(writeAsync("a.txt", [0], false), unsupported);

    await commitAsync("b.bin", "a\u0000b");
    await repository.writeAsync("b.bin", "a\u0000c");
    await assert.rejects(writeAsync("b.bin", [0], false), unsupported);

    await repository.runGitAsync(["mv", "a.txt", "moved.txt"]);
    await assert.rejects(writeAsync("moved.txt", [0], true), unsupported);
    await repository.runGitAsync(["mv", "moved.txt", "a.txt"]);

    await repository.writeAsync("a.txt", "b\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await repository.runGitAsync(["update-index", "--chmod=+x", "a.txt"]);
    await assert.rejects(writeAsync("a.txt", [0], true), unsupported);

    assert.equal(await repository.runGitAsync(["diff", "--cached", "--name-only", "--", "b.bin"]), "");
  });

  test("refuses lines that are context or past the diff's end, since they would change nothing", async () => {
    await commitAsync("long.txt", "1\n2\n3\n4\n");
    await repository.writeAsync("long.txt", "1\n2\n3\nfour\n");

    await assert.rejects(writeAsync("long.txt", [0, 1, 2, 9], false), notChosen);

    assert.equal(await indexAsync("long.txt"), "1\n2\n3\n4\n");
  });

  test("fails with git's output when git can't read the diff or refuses the patch, and a held index.lock as git's own lock failure", async () => {
    await repository.writeAsync("a.txt", "b\n");
    const folders = await repositories.readAsync(repository.folder);
    const status = await statuses.readAsync(folders);
    const index: Buffer = await readFile(path.join(repository.gitFolder, "index"));
    const runAsync = async (breaks: (run: ProgramRun) => boolean): Promise<void> => {
      const breaking: ProgramRunner = new BreakingRunner(breaks);
      await new LinesWriter(breaking, new FilterOptionsReader(breaking), "a.txt", [1], false).runAsync(folders, status);
    };

    await assert.rejects(runAsync(run => run.arguments.includes("diff")), failed("diff"));
    await writeFile(path.join(repository.gitFolder, "index"), index);
    await assert.rejects(runAsync(run => run.input.length > 0), failed("apply"));
    await writeFile(path.join(repository.gitFolder, "index"), index);
    await writeFile(path.join(repository.gitFolder, "index.lock"), "");
    await assert.rejects(writeAsync("a.txt", [1], false), (error: unknown) => error instanceof IndexLockedException);

    assert.equal(await indexAsync(), "a\n");
  });
});
