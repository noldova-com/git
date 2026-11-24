/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { DiffScope, DiffScopeKind, FailureCode, FileChange, GitCode, LineKind, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { UnsafeRepositoryException } from "../../src/exceptions/unsafe-repository.exception.ts";
import { DiffReader } from "../../src/services/diff.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("DiffReader", () => {
  const WORKTREE = new DiffScope(DiffScopeKind.Worktree);
  const STAGED = new DiffScope(DiffScopeKind.Staged);
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let reader: DiffReader;

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
    reader = new DiffReader(new ProgramRunner(supervisor.context));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const commitAsync = async (files: Readonly<Record<string, string>>, message: string): Promise<void> => {
    for (const [file, content] of Object.entries(files))
      await repository.writeAsync(file, content);
    await repository.runGitAsync(["add", ...Object.keys(files)]);
    await repository.runGitAsync(["commit", "--quiet", "-m", message]);
  };
  const changes = (diff: { files: readonly { path: string; change: FileChange }[] }): string[][] => diff.files.map(t => [t.path, t.change]);

  test("reads the worktree's changes and its untracked files with their lines, leaving out staged and ignored ones", async () => {
    await commitAsync({ "b.txt": "one\ntwo\nthree\n", "gone.txt": "g\n" }, "More");
    await repository.writeAsync("b.txt", "one\n2\nthree\n");
    await rm(path.join(repository.folder, "gone.txt"));
    await repository.writeAsync("a.txt", "staged\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await mkdir(path.join(repository.folder, "new dir"));
    await repository.writeAsync("new dir/u.txt", "u\n");
    await repository.writeAsync(".gitignore", "*.log\n");
    await repository.writeAsync("debug.log", "ignored\n");

    const diff = await reader.readAsync(repository.folder, WORKTREE, []);

    assert.deepEqual(changes(diff), [["b.txt", FileChange.Modified], ["gone.txt", FileChange.Deleted], [".gitignore", FileChange.Added], ["new dir/u.txt", FileChange.Added]]);
    assert.deepEqual(diff.files[0]?.hunks[0]?.toJson(), {
      oldStart: 1, oldCount: 3, newStart: 1, newCount: 3, header: "", lines: [
        { kind: LineKind.Context, oldNumber: 1, newNumber: 1, text: "one" },
        { kind: LineKind.Removed, oldNumber: 2, newNumber: null, text: "two" },
        { kind: LineKind.Added, oldNumber: null, newNumber: 2, text: "2" },
        { kind: LineKind.Context, oldNumber: 3, newNumber: 3, text: "three" }
      ]
    });
    assert.deepEqual(diff.files[3]?.toJson(), {
      path: "new dir/u.txt", oldPath: "new dir/u.txt", change: FileChange.Added, oldMode: null, newMode: "100644", binary: false, submodule: null,
      hunks: [{ oldStart: 0, oldCount: 0, newStart: 1, newCount: 1, header: "", lines: [{ kind: LineKind.Added, oldNumber: null, newNumber: 1, text: "u" }] }],
      truncated: false
    });
    assert.deepEqual([diff.omittedFiles, diff.truncated], [0, false]);
    assert.deepEqual(changes(await reader.readAsync(repository.folder, WORKTREE, ["new dir"])), [["new dir/u.txt", FileChange.Added]]);
  });

  test("keeps each line's carriage return, so a change of line endings shows", async () => {
    await commitAsync({ "crlf.txt": "a\r\nb\r\n" }, "Line endings");
    await repository.writeAsync("crlf.txt", "a\r\nb\n");

    const [file] = (await reader.readAsync(repository.folder, WORKTREE, [])).files;

    assert.deepEqual(file?.hunks[0]?.lines.map(t => [t.kind, t.text]), [[LineKind.Context, "a\r"], [LineKind.Removed, "b\r"], [LineKind.Added, "b"]]);
  });

  test("leaves out a file whose content is unchanged though its timestamps differ, beside a changed one, even when the repository turns off the index's refresh", async () => {
    await commitAsync({ "a.txt": "same\n", "b.txt": "one\n" }, "Two files");
    await repository.runGitAsync(["config", "diff.autoRefreshIndex", "false"]);
    const later: Date = new Date(Date.now() + 60_000);
    await utimes(path.join(repository.folder, "a.txt"), later, later);
    await repository.writeAsync("b.txt", "two\n");

    const diff = await reader.readAsync(repository.folder, WORKTREE, []);

    assert.deepEqual(changes(diff), [["b.txt", FileChange.Modified]]);
    assert.deepEqual(diff.files[0]?.hunks[0]?.lines.map(t => [t.kind, t.text]), [[LineKind.Removed, "one"], [LineKind.Added, "two"]]);
  });

  test("reads staged changes, with a rename, its old path and its similarity", async () => {
    await repository.runGitAsync(["mv", "a.txt", "moved.txt"]);
    await repository.writeAsync("new.txt", "n\n");
    await repository.runGitAsync(["add", "new.txt"]);

    const diff = await reader.readAsync(repository.folder, STAGED, []);

    assert.deepEqual(diff.files.map(t => [t.oldPath, t.path, t.change, t.hunks.length, t.similarity]),
      [["a.txt", "moved.txt", FileChange.Renamed, 0, 100], ["new.txt", "new.txt", FileChange.Added, 1, null]]);
  });

  test("reads a range, and never takes a revision for an option", async () => {
    await commitAsync({ "a.txt": "b\n", "c.bin": "\0binary\0" }, "Second");
    const output = path.join(repository.root, "written.txt");

    const diff = await reader.readAsync(repository.folder, new DiffScope(DiffScopeKind.Range, "HEAD~1", "HEAD"), []);

    assert.deepEqual(diff.files.map(t => [t.path, t.change, t.binary, t.hunks.length]), [["a.txt", FileChange.Modified, false, 1], ["c.bin", FileChange.Added, true, 0]]);
    await assert.rejects(reader.readAsync(repository.folder, new DiffScope(DiffScopeKind.Range, `--output=${output}`, "HEAD"), []), { name: "GitFailedException", code: FailureCode.Unavailable });
    assert.equal(existsSync(output), false);
  });

  test("reads a conflict that git combines and one it only marks unmerged", async () => {
    await commitAsync({ "b.txt": "b\n" }, "More");
    await repository.runGitAsync(["checkout", "--quiet", "-b", "other"]);
    await repository.writeAsync("a.txt", "theirs\n");
    await repository.runGitAsync(["rm", "--quiet", "b.txt"]);
    await repository.runGitAsync(["commit", "--quiet", "-am", "Theirs"]);
    await repository.runGitAsync(["checkout", "--quiet", "main"]);
    await commitAsync({ "a.txt": "ours\n", "b.txt": "changed\n" }, "Ours");
    await assert.rejects(repository.runGitAsync(["merge", "--quiet", "other"]));

    const diff = await reader.readAsync(repository.folder, WORKTREE, []);

    assert.deepEqual(diff.files.map(t => [t.path, t.change, t.hunks.length]), [["a.txt", FileChange.Conflict, 0], ["b.txt", FileChange.Conflict, 0]]);
  });

  test("keeps a binary conflict's combined patch out of the file before it", async () => {
    await commitAsync({ "b.bin": "\0base\0" }, "Binary");
    await repository.runGitAsync(["checkout", "--quiet", "-b", "other"]);
    await commitAsync({ "b.bin": "\0theirs\0" }, "Theirs");
    await repository.runGitAsync(["checkout", "--quiet", "main"]);
    await commitAsync({ "b.bin": "\0ours\0" }, "Ours");
    await assert.rejects(repository.runGitAsync(["merge", "--quiet", "other"]));
    await repository.writeAsync("a.txt", "changed\n");

    const diff = await reader.readAsync(repository.folder, WORKTREE, []);

    assert.deepEqual(diff.files.map(t => [t.path, t.change, t.binary, t.hunks.length]).sort(), [["a.txt", FileChange.Modified, false, 1], ["b.bin", FileChange.Conflict, false, 0]]);
  });

  test("shows an untracked file that git can't read, since it vanished before its diff or git stopped on it, as added without its lines, beside the rest of the diff", async () => {
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const scripted = new DiffReader(runner);
    await repository.writeAsync("a.txt", "changed\n");
    await repository.writeAsync("unread.txt", "u\n");
    const unread = [["a.txt", FileChange.Modified, 1, false], ["unread.txt", FileChange.Added, 0, true]];
    const files = async (): Promise<unknown[]> => (await scripted.readAsync(repository.folder, WORKTREE, [])).files.map(t => [t.path, t.change, t.hunks.length, t.truncated]);

    runner.starting = command => {
      if (command.includes("--no-index"))
        rmSync(path.join(repository.folder, "unread.txt"));
    };
    assert.deepEqual(await files(), unread);

    await repository.writeAsync("unread.txt", "u\n");
    runner.starting = () => undefined;
    runner.failing = "--no-index";
    runner.failingCode = 128;
    assert.deepEqual(await files(), unread);
  });

  test("refuses a repository git calls unsafe, naming the folder git names, scripted since its ownership can change only between the repository read and the diff", async () => {
    const runner = new ScriptedRunnerFixture(supervisor.context);
    await repository.writeAsync("a.txt", "changed\n");
    runner.failing = " diff ";
    runner.failingCode = 128;
    runner.failingErrors = "fatal: detected dubious ownership in repository at '/work/library'\n";

    await assert.rejects(new DiffReader(runner).readAsync(repository.folder, WORKTREE, []), (error: unknown): boolean => {
      assert.ok(error instanceof UnsafeRepositoryException);
      assert.deepEqual([error.code, error.gitCode, error.folder, error.output?.text], [FailureCode.NotRepository, GitCode.UnsafeRepository, "/work/library", runner.failingErrors]);
      return true;
    });
  });

  test("fails with git's output when the diff of an untracked file fails other than by finding a difference", async () => {
    const runner = new ScriptedRunnerFixture(supervisor.context);
    await repository.writeAsync("new.txt", "n\n");
    runner.failing = "--no-index";
    runner.failingCode = 129;

    await assert.rejects(new DiffReader(runner).readAsync(repository.folder, WORKTREE, []), {
      name: "GitFailedException",
      code: FailureCode.Unavailable,
      command: "diff",
      message: "git diff failed; its output comes with the failure as untrusted text."
    });
  });

  test("reads a submodule's commits", async () => {
    const library = path.join(repository.root, "library");
    await repository.runGitAsync(["init", "--quiet", library]);
    await writeFile(path.join(library, "l.txt"), "l\n");
    await repository.runGitAsync(["-C", library, "add", "l.txt"]);
    await repository.runGitAsync(["-C", library, "commit", "--quiet", "-m", "Library"]);
    await repository.runGitAsync(["-c", "protocol.file.allow=always", "submodule", "--quiet", "add", library, "library"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add the library"]);
    const inside = path.join(repository.folder, "library");
    const old = (await repository.runGitAsync(["-C", inside, "rev-parse", "HEAD"])).trim();
    await repository.runGitAsync(["-C", inside, "commit", "--quiet", "--allow-empty", "-m", "Moved"]);
    const moved = (await repository.runGitAsync(["-C", inside, "rev-parse", "HEAD"])).trim();

    const [file] = (await reader.readAsync(repository.folder, WORKTREE, [])).files;

    assert.deepEqual([file?.path, file?.submodule?.toJson(), file?.hunks.length], ["library", { oldCommit: old, newCommit: moved }, 0]);
  });

  test("shows a nested repository as added without its lines", async () => {
    await repository.runGitAsync(["init", "--quiet", path.join(repository.folder, "nested")]);
    await writeFile(path.join(repository.folder, "nested", "n.txt"), "n\n");

    const diff = await reader.readAsync(repository.folder, WORKTREE, []);

    assert.deepEqual(diff.files.map(t => [t.path, t.change, t.hunks.length, t.truncated]), [["nested/", FileChange.Added, 0, true]]);
  });

  test("shows an untracked path that isn't UTF-8 as added without its lines", async context => {
    context.skip(process.platform !== "linux", "Only Linux holds a file name that isn't UTF-8: macOS's file systems refuse one, and Windows keeps names as UTF-16.");
    const name = Buffer.concat([Buffer.from("caf"), Buffer.from([0xe9]), Buffer.from(".txt")]);
    await writeFile(Buffer.concat([Buffer.from(`${repository.folder}/`), name]), "x\n");

    const [file] = (await reader.readAsync(repository.folder, WORKTREE, [])).files;

    assert.deepEqual([file?.path, file?.pathBytes, file?.hunks.length, file?.truncated], ["caf�.txt", name.toString("base64"), 0, true]);
  });

  test("stops adding files at the whole diff's limit and counts the ones it leaves out", async () => {
    const big = `${"x".repeat(99)}\n`.repeat(8_000);
    for (const name of ["big1.txt", "big2.txt", "big3.txt", "big4.txt", "big5.txt"])
      await repository.writeAsync(name, big);
    await repository.writeAsync("small.txt", "s\n");

    const diff = await reader.readAsync(repository.folder, WORKTREE, []);

    assert.deepEqual(diff.files.map(t => [t.path, t.truncated]), [["big1.txt", true], ["big2.txt", true], ["big3.txt", true], ["big4.txt", true]]);
    assert.deepEqual([diff.omittedFiles, diff.truncated], [2, true]);
    assert.ok(diff.totalBytes <= 4 * 1024 * 1024);
    assert.ok(Buffer.byteLength(JSON.stringify(diff.toJson())) <= 4 * 1024 * 1024 + 100);
  });

  test("fails as unavailable outside a repository, with git's errors marked untrusted", async () => {
    const outside = path.join(repository.root, "outside");
    await mkdir(outside);

    await assert.rejects(reader.readAsync(outside, STAGED, []), (error: unknown) => {
      assert.ok(error instanceof GitFailedException);
      assert.deepEqual([error.code, error.message, error.output?.source], [FailureCode.Unavailable, "git diff failed; its output comes with the failure as untrusted text.", UntrustedSource.Repository]);
      return true;
    });
    await rm(outside, { recursive: true });
  });

  test("never runs a filter that the repository's own configuration names, for a tracked or an untracked file", async () => {
    const toPosix = (value: string): string => value.split(path.sep).join("/");
    const marker = path.join(repository.root, "filter-ran");
    await commitAsync({ "b.md": "b\n" }, "More");
    await repository.writeAsync(".gitattributes", "*.txt filter=evil\n*.md filter=other\n");
    await repository.runGitAsync(["config", "filter.evil.clean", `echo ran >> "${toPosix(marker)}"; cat`]);
    await repository.runGitAsync(["config", "filter.evil.required", "true"]);
    await repository.runGitAsync(["config", "filter.other.process", `sh -c 'echo ran >> "${toPosix(marker)}"'`]);
    await repository.writeAsync("a.txt", "changed\n");
    await repository.writeAsync("b.md", "changed\n");
    await repository.writeAsync("new.txt", "new\n");

    const diff = await reader.readAsync(repository.folder, WORKTREE, []);

    assert.deepEqual(changes(diff), [["a.txt", FileChange.Modified], ["b.md", FileChange.Modified], [".gitattributes", FileChange.Added], ["new.txt", FileChange.Added]]);
    assert.equal(existsSync(marker), false);
    await assert.rejects(repository.runGitAsync(["diff", "--quiet", "--", "a.txt"]), { code: 1 });
    assert.equal(existsSync(marker), true, "git itself runs the configured filter, so the read above turned it off");
  });
});
