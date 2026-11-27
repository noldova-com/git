/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test, vi } from "vitest";

import { GitRepositoryScan, ScanEnd } from "@noldova/git.protocol";

import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { RepositoryScanReader } from "../../src/services/repository-scan.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

vi.mock(import("node:fs/promises"), { spy: true });

describe("RepositoryScanReader", () => {
  let repository: RepositoryFixture;
  let work: string;
  const cleanUps: CleanUps = new CleanUps();
  let scans: RepositoryScanReader;
  const signal: AbortSignal = new AbortController().signal;

  const repositoryAt = async (...parts: string[]): Promise<string> => {
    const folder = path.join(work, ...parts);
    await mkdir(path.join(folder, ".git"), { recursive: true });
    return folder;
  };

  beforeAll(async () => {
    repository = await RepositoryFixture.createAsync();
    const supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => repository.disposeAsync());
    cleanUps.add(() => supervisor.disposeAsync());
    const runner = new ProgramRunner(supervisor.context);
    scans = new RepositoryScanReader(new RepositoryReader(runner, new GitVersionReader(runner)));
  });

  afterAll(async () => {
    await cleanUps.runAsync();
  });

  beforeEach(async () => {
    work = await mkdtemp(path.join(repository.root, "work-"));
  });

  afterEach(() => {
    vi.mocked(readdir).mockReset();
  });

  test("answers that a folder in a repository is one, without looking at its subfolders", async () => {
    await mkdir(path.join(repository.folder, "src", "inner", ".git"), { recursive: true });

    const scanned = [await scans.readAsync(repository.folder, signal), await scans.readAsync(path.join(repository.folder, "src"), signal)];

    assert.deepEqual(scanned, [new GitRepositoryScan(ScanEnd.Repository, []), new GitRepositoryScan(ScanEnd.Repository, [])]);
  });

  test("finds the repositories in the subfolders, sorted, a worktree's .git file and one nested in another included", async () => {
    const site = await repositoryAt("site");
    const inner = await repositoryAt("site", "packages", "inner");
    const api = await repositoryAt("api");
    const linked = path.join(work, "linked");
    await mkdir(linked);
    await writeFile(path.join(linked, ".git"), "gitdir: /elsewhere\n");
    await mkdir(path.join(work, "notes", "drafts"), { recursive: true });
    await writeFile(path.join(work, "readme.txt"), "");

    const scan = await scans.readAsync(work, signal);

    assert.deepEqual(scan, new GitRepositoryScan(ScanEnd.Complete, [api, linked, site, inner].toSorted()));
  });

  test("looks four folders down and no deeper", async () => {
    const fourth = await repositoryAt("1", "2", "3", "4");
    await repositoryAt("1", "2", "3", "4b", "5");

    const scan = await scans.readAsync(work, signal);

    assert.deepEqual(scan.repositories, [fourth]);
  });

  test("skips build and dependency folders and doesn't follow a link to a folder", async () => {
    for (const skipped of ["node_modules", "_build", "bin", "obj", "dist", "target", "vendor", ".venv", "venv", "__pycache__", ".cache"])
      await repositoryAt(skipped, "kit");
    const kept = await repositoryAt("apps", "web");
    await symlink(kept, path.join(work, "shortcut"), process.platform === "win32" ? "junction" : "dir");

    const scan = await scans.readAsync(work, signal);

    assert.deepEqual(scan.repositories, [kept]);
  });

  test("answers none for a folder with no repository under it, and that a folder gone or one it may not read can't be read", async () => {
    await mkdir(path.join(work, "notes", "drafts"), { recursive: true });
    const refusal = (code: string): Error => Object.assign(new Error(code), { code, syscall: "access" });

    const none = await scans.readAsync(work, signal);
    const gone = await scans.readAsync(path.join(work, "gone"), signal);
    vi.mocked(access).mockRejectedValueOnce(refusal("EACCES"));
    const denied = await scans.readAsync(work, signal);
    vi.mocked(readdir).mockRejectedValueOnce(Object.assign(refusal("EPERM"), { syscall: "scandir" }));
    const unlisted = await scans.readAsync(work, signal);
    vi.mocked(readdir).mockRejectedValueOnce(Object.assign(refusal("EIO"), { syscall: "scandir" }));

    await assert.rejects(scans.readAsync(work, signal), { code: "EIO" });
    assert.deepEqual([none, gone, denied, unlisted], [new GitRepositoryScan(ScanEnd.Complete, []), new GitRepositoryScan(ScanEnd.Unreadable, []),
      new GitRepositoryScan(ScanEnd.Unreadable, []), new GitRepositoryScan(ScanEnd.Unreadable, [])]);
  });

  test("skips a subfolder it may not read, and fails on any other read failure", async () => {
    await repositoryAt("locked");
    const { readdir: realReaddir } = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const refusal = (code: string): Error => Object.assign(new Error(code), { code, syscall: "scandir" });
    vi.mocked(readdir).mockImplementationOnce(realReaddir).mockRejectedValueOnce(refusal("EACCES"));
    const denied = await scans.readAsync(work, signal);
    vi.mocked(readdir).mockImplementationOnce(realReaddir).mockRejectedValueOnce(refusal("EIO"));

    await assert.rejects(scans.readAsync(work, signal), { code: "EIO" });
    assert.deepEqual([denied, (await scans.readAsync(work, signal)).repositories], [new GitRepositoryScan(ScanEnd.Complete, []), [path.join(work, "locked")]]);
  });

  test("stops at a thousand repositories, keeping the first by name and saying so", async () => {
    for (let index = 0; index < 1001; index++)
      await repositoryAt(`r${String(index).padStart(4, "0")}`);

    const scan = await scans.readAsync(work, signal);

    assert.deepEqual([scan.end, scan.repositories.length, scan.repositories.at(-1)], [ScanEnd.RepositoryLimit, 1000, path.join(work, "r0999")]);
  });

  test("stops after reading ten thousand folders, saying so", async () => {
    for (let index = 0; index < 120; index++)
      await mkdir(path.join(work, `f${String(index).padStart(3, "0")}`));
    const { readdir: realReaddir } = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    vi.mocked(readdir).mockImplementation(async (_folder, options) => await realReaddir(work, options));

    const scan = await scans.readAsync(work, signal);

    assert.deepEqual([scan, vi.mocked(readdir).mock.calls.length], [new GitRepositoryScan(ScanEnd.FolderLimit, []), 10_001]);
  });

  test("stops when asked, and fails on a folder that isn't absolute", async () => {
    await repositoryAt("site");
    const stop = new AbortController();
    stop.abort();

    await assert.rejects(scans.readAsync(work, stop.signal), { name: "AbortError" });
    await assert.rejects(scans.readAsync("work", signal), { name: "RepositoryNotAbsoluteException" });
  });
});
