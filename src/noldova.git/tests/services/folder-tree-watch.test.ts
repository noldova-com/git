/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { type FSWatcher, type PathLike, type WatchListener, watch } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test, vi } from "vitest";

import { Resources } from "../../src/resources.ts";
import { FolderTreeWatch } from "../../src/services/folder-tree-watch.ts";
import { IgnoredPaths } from "../../src/services/ignored-paths.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

vi.mock(import("node:fs"), { spy: true });
vi.mock(import("node:fs/promises"), { spy: true });

describe("FolderTreeWatch", () => {
  interface IOpened { readonly folder: string; readonly watcher: FSWatcher; isClosed: boolean }

  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let realWatch: typeof watch;
  let tree: FolderTreeWatch;
  let create: () => FolderTreeWatch;
  let names: (string | null)[];
  let failures: unknown[];
  let opened: IOpened[];
  let listeners: (() => boolean)[];

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    ({ watch: realWatch } = await vi.importActual<typeof import("node:fs")>("node:fs"));
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    const supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    cleanUps.add(() => {
      vi.restoreAllMocks();
    });
    names = [];
    failures = [];
    opened = [];
    listeners = [];
    await repository.writeAsync(".gitignore", "bin/\n");
    await mkdir(path.join(repository.folder, "src", "deep"), { recursive: true });
    await mkdir(path.join(repository.folder, "bin", "obj"), { recursive: true });
    await settledAsync();
    vi.mocked(watch).mockImplementation((folder: PathLike, _options: unknown, listener?: WatchListener<string>) => {
      const watcher = realWatch(folder, { persistent: false }, listener);
      const entry: IOpened = { folder: path.relative(repository.folder, String(folder)).replaceAll("\\", "/"), watcher, isClosed: false };
      watcher.on("close", () => {
        entry.isClosed = true;
        hear();
      });
      opened.push(entry);
      hear();
      return watcher;
    });
    create = () => {
      const created = new FolderTreeWatch(repository.folder, repository.folder, new IgnoredPaths(new ProgramRunner(supervisor.context)), name => {
        names.push(name);
        hear();
      }, error => {
        failures.push(error);
        hear();
      });
      cleanUps.add(() => created.close());
      return created;
    };
    tree = create();
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  /**
   * Writes a file until a watch of the worktree of its own names it: on macOS events come late, and one for the setup's writes would reach the tree's watch
   * as a change to the ignore file, walking the tree again; they come in order, so once the file is heard the setup's writes have been told.
   */
  const settledAsync = async (): Promise<void> => {
    let isHeard = false;
    let heard: () => void = () => undefined;
    const settled = new Promise<void>(resolve => {
      heard = resolve;
    });
    const probe = realWatch(repository.folder, { persistent: false }, (_event, name) => {
      if (name === "settled.txt") {
        isHeard = true;
        heard();
      }
    });
    for (let round = 0; !isHeard; round++) {
      await repository.writeAsync("settled.txt", `settled ${String(round)}\n`);
      await Promise.race([settled, new Promise<void>(resolve => setImmediate(resolve))]);
    }
    probe.close();
  };
  const hear = (): void => {
    listeners = listeners.filter(t => !t());
  };
  const untilAsync = (isDone: () => boolean): Promise<void> => new Promise(resolve => {
    const look = (): boolean => {
      if (isDone())
        resolve();
      return isDone();
    };
    if (!look())
      listeners.push(look);
  });
  const live = (): string[] => opened.filter(t => !t.isClosed).map(t => t.folder).sort();
  const openedOf = (folder: string): IOpened => {
    const found = opened.findLast(t => t.folder === folder);
    assert.ok(found !== undefined);
    return found;
  };
  const failure = (code: string): Error => Object.assign(new Error(code), { code });
  /**
   * Writes a file until the watch names it, then waits until the checks of what each name is that came before it end: on macOS a folder's watch starts a
   * moment after it is made, so it can miss the first writes, and events from just before the watch started can still come.
   */
  const heardAsync = async (file: string): Promise<void> => {
    const heard = untilAsync(() => names.includes(file));
    for (let round = 0; !names.includes(file); round++) {
      await repository.writeAsync(file, `ready ${String(round)}\n`);
      await Promise.race([heard, new Promise<void>(resolve => setImmediate(resolve))]);
    }
    for (let count = -1; count !== vi.mocked(stat).mock.results.length;) {
      count = vi.mocked(stat).mock.results.length;
      await Promise.allSettled(vi.mocked(stat).mock.results.map(t => t.value));
      await new Promise<void>(resolve => setImmediate(resolve));
    }
  };
  /** Records each question about which folders git ignores, waking a wait once its answer comes. */
  const askedOf = (): { readonly folders: string[][]; readonly answers: Promise<unknown>[] } => {
    const folders: string[][] = [];
    const answers: Promise<unknown>[] = [];
    const original = IgnoredPaths.prototype.ignoredFoldersAsync;
    vi.spyOn(IgnoredPaths.prototype, "ignoredFoldersAsync").mockImplementation(function (this: IgnoredPaths, top: string, asked: readonly string[], signal?: AbortSignal) {
      const answer = original.call(this, top, asked, signal);
      answers.push(answer.finally(() => {
        folders.push([...asked]);
        hear();
      }));
      return answer;
    });
    return { folders, answers };
  };

  test("watches the worktree and each folder in it git doesn't ignore, never the git folder or an ignored one, and names a changed file by its path", async () => {
    await tree.startAsync();
    const watched = live();
    await heardAsync("src/deep/a.txt");
    openedOf("").watcher.emit("change", "change", null);

    assert.deepEqual([watched, names.includes(null), failures], [["", "src", "src/deep"], true, []]);
  });

  test("watches a folder made later unless git ignores it, and drops the watches of a folder removed", async () => {
    // Only the top's watch, started well before, hears these: on macOS a new folder's watch starts a moment after it is made and can miss what comes first.
    await rm(path.join(repository.folder, "bin"), { recursive: true });
    const asked = askedOf();
    await tree.startAsync();
    await mkdir(path.join(repository.folder, "made", "inner"), { recursive: true });
    await mkdir(path.join(repository.folder, "bin"));
    await untilAsync(() => live().includes("made/inner") && asked.folders.some(t => t.length === 1 && t[0] === "bin"));
    const withIgnored = live();
    await rm(path.join(repository.folder, "made"), { recursive: true });
    await untilAsync(() => !live().some(t => t.startsWith("made")));

    assert.deepEqual([withIgnored, live(), failures], [["", "made", "made/inner", "src", "src/deep"], ["", "src", "src/deep"], []]);
  });

  test("walks the tree again when an ignore file changes, forgetting what git ignored, so a folder a new rule ignores loses its watch", async () => {
    await tree.startAsync();
    const before = live();
    const asked = askedOf();
    await repository.writeAsync(".gitignore", "bin/\nsrc/\n");
    await untilAsync(() => asked.folders.some(t => t.includes("src")));
    // Writing the file can be heard twice, once emptied and once written, so this waits until the walks it started stop asking git.
    for (let count = -1; count !== asked.answers.length;) {
      count = asked.answers.length;
      await Promise.allSettled(asked.answers);
      await new Promise<void>(resolve => setImmediate(resolve));
    }

    assert.deepEqual([before, live(), failures], [["", "src", "src/deep"], [""], []]);
  });

  test("walks the tree once at a time, so a folder heard made while a walk runs keeps one watch", async () => {
    await tree.startAsync();
    const checked = vi.mocked(stat).mock.results.length;
    const answers: Promise<unknown>[] = [];
    const original = IgnoredPaths.prototype.ignoredFoldersAsync;
    let earlier: Promise<unknown> = Promise.resolve();
    // A check of what a heard name is that started before a walk asks git ends before git answers, and git answers in the order it was asked, as it can on
    // any disk; a walk run alongside would then find the folder unwatched, ask git, and watch it after the other walk did.
    vi.spyOn(IgnoredPaths.prototype, "ignoredFoldersAsync").mockImplementation(async function (this: IgnoredPaths, top: string, asked: readonly string[],
      signal?: AbortSignal) {
      const checks = vi.mocked(stat).mock.results.slice(checked).map(t => t.value);
      const answer = original.call(this, top, asked, signal);
      const inOrder = earlier.then(() => answer);
      earlier = inOrder.catch(() => undefined);
      answers.push(answer);
      await Promise.allSettled(checks);
      return inOrder;
    });
    const top = openedOf("").watcher;
    top.emit("change", "change", ".gitignore");
    top.emit("change", "rename", "src");
    await untilAsync(() => opened.filter(t => t.folder === "src/deep").length >= 2);
    for (let count = -1; count !== answers.length + vi.mocked(stat).mock.results.length;) {
      count = answers.length + vi.mocked(stat).mock.results.length;
      await Promise.allSettled([...answers, ...vi.mocked(stat).mock.results.map(t => t.value)]);
      await new Promise<void>(resolve => setImmediate(resolve));
    }

    assert.deepEqual([live(), failures], [["", "src", "src/deep"], []]);
  });

  test("fails past the folders it watches in one worktree, leaving nothing watched", async () => {
    const limit = Resources.treeFoldersLimit;
    Object.defineProperty(Resources, "treeFoldersLimit", { value: 2, configurable: true, writable: true });
    cleanUps.add(() => {
      Object.defineProperty(Resources, "treeFoldersLimit", { value: limit, configurable: true, writable: true });
    });

    await assert.rejects(tree.startAsync(), (error: unknown) =>
      error instanceof RangeError && error.message === `${repository.folder} has more than 2 folders git doesn't ignore, more than the module watches one at a time`);
    await untilAsync(() => live().length === 0);
  });

  test("ends the whole watch when a folder still there fails, but drops only the watch of a folder gone, and hears nothing once closed", async () => {
    await tree.startAsync();
    await heardAsync("src/deep/ready.txt");
    const deep = openedOf("src/deep");
    vi.mocked(stat).mockRejectedValueOnce(failure("ENOENT"));
    deep.watcher.emit("error", new Error("The folder went away."));
    await untilAsync(() => deep.isClosed);
    const afterGone = live();
    const src = openedOf("src");
    src.watcher.emit("error", new Error("The folder failed."));
    await untilAsync(() => failures.length > 0 && live().length === 0);
    src.watcher.emit("change", "rename", "late.txt");
    src.watcher.emit("error", new Error("The folder failed again."));
    await new Promise<void>(resolve => setImmediate(resolve));

    assert.deepEqual([afterGone, failures.map(String), names.includes("src/late.txt")], [["", "src"], ["Error: The folder failed."], false]);
  });

  test("skips a folder gone before it is read, and fails the start on any other error reading one", async () => {
    vi.mocked(readdir).mockRejectedValueOnce(failure("ENOENT"));
    await tree.startAsync();
    const gone = live();
    tree.close();
    await untilAsync(() => live().length === 0);
    vi.mocked(readdir).mockRejectedValueOnce(failure("EACCES"));

    await assert.rejects(create().startAsync(), (error: unknown) => error instanceof Error && error.message === "EACCES");
    assert.deepEqual(gone, [""]);
  });

  test("ends the watch when it can't tell whether a changed name is a folder", async () => {
    await tree.startAsync();
    await heardAsync("src/ready.txt");
    vi.mocked(stat).mockRejectedValueOnce(failure("EACCES"));
    await repository.writeAsync("src/b.txt", "b\n");
    await untilAsync(() => failures.length > 0 && live().length === 0);

    assert.deepEqual(failures.map(String), ["Error: EACCES"]);
  });
});
