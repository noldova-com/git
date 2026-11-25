/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, lstat, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test, vi } from "vitest";

import { ConflictKind, FailureCode, FileState, type GitStatus, OperationKind, RemoteTransport, type StatusEntry, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { Resources } from "../../src/resources.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

vi.mock(import("node:fs/promises"), { spy: true });

describe("StatusReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let reader: StatusReader;
  let repositories: RepositoryReader;

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
    const runner = new ProgramRunner(supervisor.context);
    reader = new StatusReader(runner);
    repositories = new RepositoryReader(runner, new GitVersionReader(runner));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const headAsync = async (folder: string = repository.folder): Promise<string> => (await repository.runGitAsync(["-C", folder, "rev-parse", "HEAD"])).trim();
  const readAsync = async (folder: string = repository.folder): Promise<GitStatus> => await reader.readAsync(await repositories.readAsync(folder));
  const states = (entries: readonly StatusEntry[]): string[][] => entries.map(t => [t.path, t.index, t.worktree]);

  test("reads a clean worktree on its branch", async () => {
    const status = await readAsync();

    assert.deepEqual(status.toJson(), {
      branch: "main", head: await headAsync(), upstream: null, entries: [], truncated: false, fingerprint: status.fingerprint, operation: null, remote: null,
      uncheckedLfsFiles: 0,
      fetchedAt: null
    });
    assert.match(status.fingerprint, /^[0-9a-f]{64}$/v);
  });

  test("reads staged, unstaged, renamed, deleted and untracked changes, in git's order", async () => {
    await repository.writeAsync("b.txt", "b\n");
    await repository.writeAsync("c.txt", "c\n");
    await repository.runGitAsync(["add", "b.txt", "c.txt"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "More"]);
    await repository.writeAsync("a.txt", "changed\n");
    await repository.runGitAsync(["mv", "b.txt", "moved.txt"]);
    await repository.runGitAsync(["rm", "--quiet", "c.txt"]);
    await repository.writeAsync("staged.txt", "s\n");
    await repository.runGitAsync(["add", "staged.txt"]);
    await mkdir(path.join(repository.folder, "new dir"));
    await repository.writeAsync("new dir/untracked.txt", "u\n");
    await repository.writeAsync(".gitignore", "*.log\n");
    await repository.writeAsync("debug.log", "ignored\n");

    const status = await readAsync();

    assert.deepEqual(states(status.entries), [
      ["a.txt", FileState.Unmodified, FileState.Modified],
      ["c.txt", FileState.Deleted, FileState.Unmodified],
      ["moved.txt", FileState.Renamed, FileState.Unmodified],
      ["staged.txt", FileState.Added, FileState.Unmodified],
      [".gitignore", FileState.Untracked, FileState.Untracked],
      ["new dir/untracked.txt", FileState.Untracked, FileState.Untracked]
    ]);
    assert.equal(status.entries[2]?.originalPath, "b.txt");
  });

  test("reads a repository with no commits, and a detached HEAD", async () => {
    const empty = path.join(repository.root, "empty");
    await repository.runGitAsync(["init", "--quiet", empty]);
    await repository.runGitAsync(["checkout", "--quiet", "--detach"]);

    const status = await readAsync(empty);

    assert.deepEqual(status.toJson(), { branch: "main", head: null, upstream: null, entries: [], truncated: false, fingerprint: status.fingerprint, operation: null, remote: null,
      uncheckedLfsFiles: 0, fetchedAt: null });
    assert.equal((await readAsync()).branch, null);
  });

  test("reads how far a clone's branch is from its upstream, and an upstream that is gone", async () => {
    const remote = path.join(repository.root, "remote.git");
    const clone = path.join(repository.root, "clone");
    await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
    await repository.runGitAsync(["clone", "--quiet", remote, clone]);
    await repository.runGitAsync(["-C", clone, "commit", "--quiet", "--allow-empty", "-m", "Ahead"]);

    const status = await readAsync(clone);

    assert.deepEqual(status.upstream?.toJson(), { name: "origin/main", ahead: 1, behind: 0, gone: false, id: (await repository.runGitAsync(["-C", remote, "rev-parse", "main"])).trim() });
    assert.deepEqual(status.remote?.toJson(), { name: "origin", host: null, path: null, transport: RemoteTransport.File });

    await repository.runGitAsync(["-C", remote, "branch", "-m", "main", "renamed"]);
    await repository.runGitAsync(["-C", clone, "fetch", "--quiet", "--prune"]);
    assert.deepEqual((await readAsync(clone)).upstream?.toJson(), { name: "origin/main", ahead: 0, behind: 0, gone: true, id: null });
  });

  test("reads when the worktree last fetched from its FETCH_HEAD, to the second, and no time before its first fetch", async () => {
    const remote = path.join(repository.root, "remote.git");
    const clone = path.join(repository.root, "clone");
    await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
    await repository.runGitAsync(["clone", "--quiet", remote, clone]);
    const before = (await readAsync(clone)).fetchedAt;
    await repository.runGitAsync(["-C", clone, "fetch", "--quiet"]);
    await utimes(path.join(clone, ".git", "FETCH_HEAD"), new Date("2026-11-22T18:05:00.750Z"), new Date("2026-11-22T18:05:00.750Z"));

    assert.deepEqual([before, (await readAsync(clone)).fetchedAt], [null, "2026-11-22T18:05:00Z"]);
  });

  test("fails when FETCH_HEAD is there but can't be read", async () => {
    const denied = Object.assign(new Error("denied"), { code: "EACCES" });
    vi.mocked(lstat).mockImplementation(async (file, options) => {
      if (String(file).endsWith("FETCH_HEAD"))
        throw denied;
      return await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises").then(t => t.lstat(file, options));
    });
    try {
      await assert.rejects(readAsync(), denied);
    } finally {
      vi.mocked(lstat).mockRestore();
    }
  });

  test("reads no upstream commit when git can't resolve the tracking ref, and fails with git's errors marked untrusted when it can't read it", async () => {
    const remote = path.join(repository.root, "remote.git");
    const clone = path.join(repository.root, "clone");
    await repository.runGitAsync(["clone", "--quiet", "--bare", repository.folder, remote]);
    await repository.runGitAsync(["clone", "--quiet", remote, clone]);
    const scripted = new ScriptedRunnerFixture(supervisor.context);
    const scriptedReader = new StatusReader(scripted);
    const folders = await repositories.readAsync(clone);
    scripted.failing = "@{upstream}";

    assert.equal((await scriptedReader.readAsync(folders)).upstream?.id, null);
    scripted.failingCode = 128;
    await assert.rejects(scriptedReader.readAsync(folders), (error: unknown) =>
      error instanceof GitFailedException && error.command === "rev-parse" && error.output?.source === UntrustedSource.Repository);
  });

  test("reads a merge conflict", async () => {
    await repository.runGitAsync(["checkout", "--quiet", "-b", "other"]);
    await repository.writeAsync("a.txt", "theirs\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Theirs"]);
    await repository.runGitAsync(["checkout", "--quiet", "main"]);
    await repository.writeAsync("a.txt", "ours\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Ours"]);
    await assert.rejects(repository.runGitAsync(["merge", "--quiet", "other"]));

    const status = await readAsync();

    assert.equal(status.entries[0]?.path, "a.txt");
    assert.equal(status.entries[0]?.conflict, ConflictKind.BothModified);
    assert.deepEqual(status.operation?.toJson(), {
      kind: OperationKind.Merge,
      from: (await repository.runGitAsync(["rev-parse", "other"])).trim(),
      message: "Merge branch 'other'"
    });
  });

  test("reads a submodule whose commit and files changed", async () => {
    const library = path.join(repository.root, "library");
    await repository.runGitAsync(["init", "--quiet", library]);
    await writeFile(path.join(library, "l.txt"), "l\n");
    await repository.runGitAsync(["-C", library, "add", "l.txt"]);
    await repository.runGitAsync(["-C", library, "commit", "--quiet", "-m", "Library"]);
    await repository.runGitAsync(["-c", "protocol.file.allow=always", "submodule", "--quiet", "add", library, "library"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add the library"]);
    const inside = path.join(repository.folder, "library");
    await repository.runGitAsync(["-C", inside, "commit", "--quiet", "--allow-empty", "-m", "Moved"]);
    await writeFile(path.join(inside, "l.txt"), "changed\n");
    await writeFile(path.join(inside, "new.txt"), "new\n");

    const [entry] = (await readAsync()).entries;

    assert.equal(entry?.path, "library");
    assert.deepEqual(entry?.submodule?.toJson(), { commitChanged: true, trackedChanges: true, untrackedChanges: true });
    const before = (await readAsync()).fingerprint;
    await repository.runGitAsync(["-C", inside, "commit", "--quiet", "--allow-empty", "-m", "Moved again"]);
    assert.notEqual((await readAsync()).fingerprint, before, "a submodule moved to another commit changes the fingerprint");
  });

  test("keeps a path that isn't UTF-8 as its bytes", async context => {
    context.skip(process.platform !== "linux", "Only Linux holds a file name that isn't UTF-8: macOS's file systems refuse one, and Windows keeps names as UTF-16.");
    const name = Buffer.concat([Buffer.from("caf"), Buffer.from([0xe9]), Buffer.from(".txt")]);
    await writeFile(Buffer.concat([Buffer.from(`${repository.folder}/`), name]), "x\n");

    const [entry] = (await readAsync()).entries;

    assert.equal(entry?.path, "caf�.txt");
    assert.equal(entry?.pathBytes, name.toString("base64"));
  });

  test("fails as unavailable outside a repository, with git's errors marked untrusted", async () => {
    const outside = path.join(repository.root, "outside");
    await mkdir(outside);

    await assert.rejects(reader.readAsync(new RepositoryFolders(outside, path.join(outside, ".git"), path.join(outside, ".git"))), (error: unknown) => {
      assert.ok(error instanceof GitFailedException && error.output !== null);
      assert.deepEqual({ ...error }, { name: "GitFailedException", code: FailureCode.Unavailable, gitCode: null, command: "status", output: { text: error.output.text, source: UntrustedSource.Repository } });
      assert.equal(error.message, "git status failed; its output comes with the failure as untrusted text.");
      assert.match(error.output.text, /not a git repository/v);
      return true;
    });
    await rm(outside, { recursive: true });
  });

  test("counts the lines each changed side adds and removes", async () => {
    await repository.writeAsync("a.txt", "one\ntwo\n");
    await repository.runGitAsync(["add", "a.txt"]);
    await repository.writeAsync("a.txt", "one\n");
    await repository.writeAsync("new.txt", "x\ny\n");

    const status = await readAsync();

    assert.deepEqual(status.entries.map(t => [t.path, t.indexCounts?.toJson() ?? null, t.worktreeCounts?.toJson() ?? null]), [
      ["a.txt", { added: 2, removed: 1 }, { added: 0, removed: 1 }],
      ["new.txt", null, { added: 2, removed: 0 }]
    ]);
  });

  test("names the remote the branch works with, else the only remote, and none when it can't tell", async () => {
    await repository.runGitAsync(["remote", "add", "origin", "https://person:token-value@host.example/team/repo.git"]);
    assert.deepEqual((await readAsync()).remote?.toJson(), { name: "origin", host: "host.example", path: "team/repo", transport: RemoteTransport.Https });

    await repository.runGitAsync(["remote", "add", "fork", "git@example.com:person/git.git"]);
    assert.equal((await readAsync()).remote, null);

    await repository.runGitAsync(["config", "branch.main.remote", "fork"]);
    assert.deepEqual((await readAsync()).remote?.toJson(), { name: "fork", host: "example.com", path: "person/git", transport: RemoteTransport.Ssh });

    await repository.runGitAsync(["config", "branch.main.remote", "gone"]);
    assert.equal((await readAsync()).remote, null);
  });

  test("moves the fingerprint when a changed file is edited again or the index changes, and keeps it while nothing does", async () => {
    await repository.writeAsync("a.txt", "changed\n");
    const first = (await readAsync()).fingerprint;
    assert.equal((await readAsync()).fingerprint, first);

    await repository.writeAsync("a.txt", "changed again, to a longer text\n");
    const edited = (await readAsync()).fingerprint;
    assert.notEqual(edited, first);

    await repository.runGitAsync(["add", "a.txt"]);
    assert.notEqual((await readAsync()).fingerprint, edited);
  });

  const lfsPointer = (content: string): string =>
    `version https://git-lfs.github.com/spec/v1\noid sha256:${createHash("sha256").update(content).digest("hex")}\nsize ${Buffer.byteLength(content)}\n`;
  const trackLfsAsync = async (files: Readonly<Record<string, string>>): Promise<void> => {
    await repository.writeAsync(".gitattributes", "*.bin filter=lfs diff=lfs merge=lfs -text\n");
    for (const [file, content] of Object.entries(files))
      await repository.writeAsync(file, lfsPointer(content));
    await repository.runGitAsync(["add", ".gitattributes", ...Object.keys(files)]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Track LFS"]);
  };

  test("counts an LFS file whose content matches its pointer unchanged, and keeps a changed one, a pointer checked out without smudge and other files as git reads them", async () => {
    await trackLfsAsync({ "kept.bin": "kept\n", "grown.bin": "old\n", "same-size.bin": "abcd\n", "pointer.bin": "never smudged\n" });
    await repository.writeAsync("kept.bin", "kept\n");
    await repository.writeAsync("grown.bin", "a new content\n");
    await repository.writeAsync("same-size.bin", "wxyz\n");
    await repository.writeAsync("a.txt", await repository.runGitAsync(["show", "HEAD:a.txt"]));
    await repository.writeAsync("changed.txt", "changed\n");
    await repository.runGitAsync(["add", "changed.txt"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Text"]);
    await repository.writeAsync("changed.txt", "changed again\n");

    const status = await readAsync();

    assert.deepEqual(states(status.entries), [
      ["changed.txt", FileState.Unmodified, FileState.Modified],
      ["grown.bin", FileState.Unmodified, FileState.Modified],
      ["same-size.bin", FileState.Unmodified, FileState.Modified]
    ]);
  });

  test("reads an LFS file's pointer once across reads, and reads the file as changed once its content moves", async () => {
    await trackLfsAsync({ "kept.bin": "kept\n" });
    await repository.writeAsync("kept.bin", "kept\n");
    const pointers = (): number => supervisor.requests.filter(t => t.arguments.includes("--batch")).length;

    const first = states((await readAsync()).entries);
    const afterFirst = pointers();
    const second = states((await readAsync()).entries);
    await repository.writeAsync("kept.bin", "kept, then changed\n");
    const changed = states((await readAsync()).entries);

    assert.deepEqual([first, afterFirst, second, pointers(), changed], [[], 1, [], 1, [["kept.bin", FileState.Unmodified, FileState.Modified]]]);
  });

  const withResourceAsync = async <T>(name: "lfsHashBytes" | "lfsCacheEntries", value: number, action: () => Promise<T>): Promise<T> => {
    const before = Resources[name];
    Object.defineProperty(Resources, name, { value, configurable: true, writable: true });
    try {
      return await action();
    } finally {
      Object.defineProperty(Resources, name, { value: before, configurable: true, writable: true });
    }
  };

  test("counts an LFS file the hash budget can't reach as unchecked, leaving it as git reads it, and checks it on a later read", async () => {
    await trackLfsAsync({ "a.bin": "aaaa\n", "b.bin": "bbbb\n" });
    await repository.writeAsync("a.bin", "aaaa\n");
    await repository.writeAsync("b.bin", "bbbb\n");

    const [first, second] = await withResourceAsync("lfsHashBytes", 6, async () => [await readAsync(), await readAsync()]);

    assert.deepEqual([states(first.entries), first.uncheckedLfsFiles], [[["b.bin", FileState.Unmodified, FileState.Modified]], 1]);
    assert.deepEqual([states(second.entries), second.uncheckedLfsFiles], [[], 0]);
  });

  test("counts an LFS file whose pointer the check couldn't keep as unchecked, rather than as changed", async () => {
    await trackLfsAsync({ "a.bin": "aaaa\n", "b.bin": "bbbb\n" });
    await repository.writeAsync("a.bin", "aaaa\n");
    await repository.writeAsync("b.bin", "bbbb\n");

    const status = await withResourceAsync("lfsCacheEntries", 1, readAsync);

    assert.deepEqual([states(status.entries), status.uncheckedLfsFiles], [[["a.bin", FileState.Unmodified, FileState.Modified]], 1]);
  });

  test("checks any number of LFS files with one check-attr and two cat-file runs, past the old limit of a thousand", async () => {
    const files = Object.fromEntries(Array.from({ length: 1_500 }, (_, index) => [`many-${index}.bin`, `${index}\n`]));
    const attributes = "*.bin filter=lfs diff=lfs merge=lfs -text\n";
    const inline = (file: string, content: string): string => `M 100644 inline ${file}\ndata ${String(Buffer.byteLength(content))}\n${content}\n`;
    await repository.runGitAsync(["fast-import", "--quiet"], [
      `commit ${(await repository.runGitAsync(["symbolic-ref", "HEAD"])).trim()}`,
      "committer Noldova Test <test@example.invalid> 1767225600 +0000",
      "data 9",
      "Track LFS",
      `from ${await headAsync()}`,
      inline(".gitattributes", attributes) + Object.entries(files).map(([file, content]) => inline(file, lfsPointer(content))).join("")
    ].join("\n"));
    await repository.runGitAsync(["read-tree", "HEAD"]);
    await repository.writeAsync(".gitattributes", attributes);
    for (const [file, content] of Object.entries(files))
      await repository.writeAsync(file, content);
    const before = supervisor.requests.length;

    const status = await readAsync();
    const runs = supervisor.requests.slice(before).map(t => t.arguments.find(u => u === "check-attr" || u === "cat-file")).filter(t => t !== undefined);

    assert.deepEqual([status.entries.length, status.uncheckedLfsFiles, runs], [0, 0, ["check-attr", "cat-file", "cat-file"]]);
  });

  test("leaves a big blob that LFS attributes name as git reads it, without counting it unchecked", async () => {
    await repository.writeAsync("big.bin", "x".repeat(2_000));
    await repository.runGitAsync(["add", "big.bin"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Big"]);
    await repository.writeAsync(".gitattributes", "*.bin filter=lfs diff=lfs merge=lfs -text\n");
    await repository.runGitAsync(["add", ".gitattributes"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Track"]);
    await repository.writeAsync("big.bin", "y".repeat(2_000));

    const status = await readAsync();

    assert.deepEqual([states(status.entries), status.uncheckedLfsFiles], [[["big.bin", FileState.Unmodified, FileState.Modified]], 0]);
  });

  test("never runs an fsmonitor command that the repository's own configuration names", async () => {
    const marker = path.join(repository.root, "fsmonitor-ran");
    const hook = path.join(repository.root, "fsmonitor-hook");
    const toPosix = (value: string): string => value.split(path.sep).join("/");
    await writeFile(hook, ["#!/bin/sh", `: > "${toPosix(marker)}"`, "exit 1", ""].join(String.fromCharCode(10)));
    await chmod(hook, 0o755);
    await repository.runGitAsync(["config", "core.fsmonitor", toPosix(hook)]);
    await repository.writeAsync("a.txt", "changed" + String.fromCharCode(10));

    assert.equal((await readAsync()).entries.length, 1);
    assert.equal(existsSync(marker), false);
    await repository.runGitAsync(["status", "--porcelain"]);
    assert.equal(existsSync(marker), true, "git itself runs the configured command, so the read above turned it off");
  });

  test("never runs a clean or process filter that the repository's own configuration names, and keeps the person's own filters", async () => {
    const toPosix = (value: string): string => value.split(path.sep).join("/");
    const clean = path.join(repository.root, "clean-ran");
    const processed = path.join(repository.root, "process-ran");
    const own = path.join(repository.root, "own-ran");
    const line = String.fromCharCode(10);
    await repository.writeAsync("b.md", "b" + line);
    await repository.writeAsync("c.log", "c" + line);
    await repository.runGitAsync(["add", "b.md", "c.log"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "More"]);
    await repository.writeAsync(".gitattributes", ["*.txt filter=evil", "*.md filter=other", "*.log filter=own", ""].join(line));
    await repository.runGitAsync(["config", "filter.evil.clean", `echo ran >> "${toPosix(clean)}"; cat`]);
    await repository.runGitAsync(["config", "filter.evil.required", "true"]);
    await repository.runGitAsync(["config", "filter.other.process", `sh -c 'echo ran >> "${toPosix(processed)}"'`]);
    await mkdir(path.join(repository.configuration, "git"), { recursive: true });
    await repository.runGitAsync(["config", "--file", path.join(repository.configuration, "git", "config"), "filter.own.clean", `echo ran >> "${toPosix(own)}"; cat`]);
    await repository.writeAsync("a.txt", "changed" + line);
    await repository.writeAsync("b.md", "changed" + line);
    await repository.writeAsync("c.log", "changed" + line);

    assert.deepEqual(states((await readAsync()).entries), [
      ["a.txt", FileState.Unmodified, FileState.Modified],
      ["b.md", FileState.Unmodified, FileState.Modified],
      ["c.log", FileState.Unmodified, FileState.Modified],
      [".gitattributes", FileState.Untracked, FileState.Untracked]
    ]);
    assert.deepEqual([existsSync(clean), existsSync(processed), existsSync(own)], [false, false, true]);
    await assert.rejects(repository.runGitAsync(["diff", "--quiet", "--", "a.txt"]), { code: 1 });
    assert.equal(existsSync(clean), true, "git itself runs the configured filter, so the read above turned it off");
    await assert.rejects(repository.runGitAsync(["diff", "--quiet", "--", "b.md"]), (error: unknown) => error instanceof Error && "code" in error && (error.code === 1 || error.code === 128),
      "the process filter quits without answering git's handshake, so git fails the diff: git 2.53 with 128, as the remote end hung up, and git 2.55 and later and Git for Windows with 1");
    assert.equal(existsSync(processed), true, "git itself runs the configured process filter, so the read above turned it off");
  });

  test("never runs a clean filter that a checked-out submodule's own configuration names, at any depth", async () => {
    const toPosix = (value: string): string => value.split(path.sep).join("/");
    const line = String.fromCharCode(10);
    const shallow = path.join(repository.root, "library-ran");
    const deep = path.join(repository.root, "inner-ran");
    const sources = { library: path.join(repository.root, "library"), inner: path.join(repository.root, "inner") };
    for (const [name, source] of Object.entries(sources)) {
      await repository.runGitAsync(["init", "--quiet", source]);
      await writeFile(path.join(source, `${name}.txt`), "a" + line);
      await repository.runGitAsync(["-C", source, "add", `${name}.txt`]);
      await repository.runGitAsync(["-C", source, "commit", "--quiet", "-m", name]);
    }
    await repository.runGitAsync(["-C", sources.library, "-c", "protocol.file.allow=always", "submodule", "--quiet", "add", sources.inner, "inner"]);
    await repository.runGitAsync(["-C", sources.library, "commit", "--quiet", "-m", "Add the inner library"]);
    await repository.runGitAsync(["-c", "protocol.file.allow=always", "submodule", "--quiet", "add", sources.library, "library"]);
    await repository.runGitAsync(["-c", "protocol.file.allow=always", "submodule", "--quiet", "update", "--init", "--recursive"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add the library"]);
    const library = path.join(repository.folder, "library");
    const inner = path.join(library, "inner");
    await writeFile(path.join(library, ".gitattributes"), "*.txt filter=shallow" + line);
    await writeFile(path.join(inner, ".gitattributes"), "*.txt filter=deep" + line);
    await repository.runGitAsync(["-C", library, "config", "filter.shallow.clean", `echo ran >> "${toPosix(shallow)}"; cat`]);
    await repository.runGitAsync(["-C", inner, "config", "filter.deep.clean", `echo ran >> "${toPosix(deep)}"; cat`]);
    await writeFile(path.join(library, "library.txt"), "b" + line);
    await writeFile(path.join(inner, "inner.txt"), "b" + line);

    const [entry] = (await readAsync()).entries;

    assert.equal(entry?.path, "library");
    assert.equal(entry?.submodule?.trackedChanges, true);
    assert.deepEqual([existsSync(shallow), existsSync(deep)], [false, false]);
    await repository.runGitAsync(["status", "--porcelain"]);
    assert.deepEqual([existsSync(shallow), existsSync(deep)], [true, true], "git's own status runs both submodules' filters, so the read above turned them off");
  });
});
