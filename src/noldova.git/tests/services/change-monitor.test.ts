/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { type FSWatcher, type PathLike, type WatchListener, watch } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import timers from "node:timers";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test, vi } from "vitest";

import { FakeModuleLog } from "@noldova/desktop.runtime/testing";

import { WatchStart } from "../../src/enums/watch-start.ts";
import { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { ChangeMonitor } from "../../src/services/change-monitor.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

vi.mock(import("node:fs"), { spy: true });
vi.mock(import("node:fs/promises"), { spy: true });

describe("ChangeMonitor", () => {
  const KEY = "conversation:QA-KEY-7f3c";
  const OTHER = "conversation:QA-KEY-9d2e";
  const DEBOUNCE = 200;
  const POLL = 5_000;
  const TOUCH = 100;
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let monitor: ChangeMonitor;
  let changes: [string, number][];
  let lines: string[];
  let waits: { milliseconds: number; fire: () => void; timer: NodeJS.Timeout; isCleared: boolean; isTaken: boolean }[];
  let asked: { milliseconds: number; resolve: (wait: (typeof waits)[number]) => void }[];
  let heard: { count: () => number; resolve: () => void }[];

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
    cleanUps.add(() => {
      vi.restoreAllMocks();
    });
    changes = [];
    lines = [];
    waits = [];
    asked = [];
    heard = [];
    const original = timers.setTimeout;
    const originalClear = timers.clearTimeout;
    vi.spyOn(timers, "setTimeout").mockImplementation((...values: Parameters<typeof timers.setTimeout>) => {
      const [handler, delay] = values;
      if (delay !== DEBOUNCE && delay !== POLL && delay !== TOUCH)
        return original(...values);
      const wait = { milliseconds: delay, fire: (): void => handler(), timer: original(() => undefined, 2_147_483_647), isCleared: false, isTaken: false };
      waits.push(wait);
      const listener = asked.find(t => t.milliseconds === delay);
      if (listener !== undefined) {
        asked = asked.filter(t => t !== listener);
        wait.isTaken = true;
        listener.resolve(wait);
      }
      return wait.timer;
    });
    vi.spyOn(timers, "clearTimeout").mockImplementation((...values: Parameters<typeof timers.clearTimeout>) => {
      const [timer] = values;
      for (const wait of waits.filter(t => t.timer === timer))
        wait.isCleared = true;
      originalClear(...values);
    });
    const hear = (): void => {
      for (const listener of heard.filter(t => t.count() <= 0))
        listener.resolve();
      heard = heard.filter(t => t.count() > 0);
    };
    const log = new FakeModuleLog();
    log.answer("write", line => {
      lines.push(line);
      hear();
    });
    monitor = new ChangeMonitor(new ProgramRunner(supervisor.context), log, (key, sequence) => {
      changes.push([key, sequence]);
      hear();
    });
    cleanUps.add(() => monitor.disposeAsync());
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const folders = (): RepositoryFolders => new RepositoryFolders(repository.folder, repository.gitFolder, repository.gitFolder);
  const branchesFolder = (): string => path.join(repository.gitFolder, "refs", "heads");
  const isCookie = (name: string): boolean => name.startsWith("noldova-watch-");
  const cookiesAsync = async (): Promise<string[][]> => [(await readdir(repository.gitFolder)).filter(isCookie), (await readdir(branchesFolder())).filter(isCookie)];
  const nextWaitAsync = async (milliseconds: number): Promise<(typeof waits)[number]> => {
    const waiting = waits.find(t => t.milliseconds === milliseconds && !t.isTaken && !t.isCleared);
    if (waiting !== undefined) {
      waiting.isTaken = true;
      return waiting;
    }
    const { promise, resolve } = Promise.withResolvers<(typeof waits)[number]>();
    asked.push({ milliseconds, resolve });
    return await promise;
  };
  const fireNextAsync = async (milliseconds: number): Promise<void> => {
    (await nextWaitAsync(milliseconds)).fire();
  };
  const touchingAsync = async <T>(work: Promise<T>): Promise<T> => {
    const settled = work.then(() => null, () => null);
    for (;;) {
      // A touch comes after time passes, so the file system's work runs before each one.
      await new Promise<void>(resolve => timers.setImmediate(resolve));
      const waiting = waits.find(t => t.milliseconds === TOUCH && !t.isTaken && !t.isCleared);
      if (waiting !== undefined) {
        waiting.isTaken = true;
        waiting.fire();
        continue;
      }
      const { promise, resolve } = Promise.withResolvers<(typeof waits)[number]>();
      const listener = { milliseconds: TOUCH, resolve };
      asked.push(listener);
      const touch = await Promise.race([settled, promise]);
      asked = asked.filter(t => t !== listener);
      if (touch === null)
        return await work;
      touch.fire();
    }
  };
  const startedAsync = (key: string = KEY): Promise<WatchStart> => touchingAsync(monitor.startedAsync(key));
  const untilAsync = async (count: () => number): Promise<void> => {
    if (count() <= 0)
      return;
    const { promise, resolve } = Promise.withResolvers<void>();
    heard.push({ count, resolve });
    await promise;
  };
  const untilChangesAsync = (count: number): Promise<void> => untilAsync(() => count - changes.length);
  const untilLinesAsync = (count: number): Promise<void> => untilAsync(() => count - lines.length);
  const watchersOf = (from: number): FSWatcher[] => vi.mocked(watch).mock.results.slice(from).map(t => {
    assert.ok(t.type === "return");
    return t.value;
  });
  const seenAsync = (watcher: FSWatcher, matches: (name: string) => boolean): Promise<void> => new Promise(resolve => {
    const listener = (_event: string, file: unknown): void => {
      if (typeof file !== "string" || !matches(file))
        return;
      watcher.off("change", listener);
      resolve();
    };
    watcher.on("change", listener);
  });

  test("announces a commit that it sees through HEAD, the index and the branch", async () => {
    monitor.watch(KEY, repository.folder, folders());
    await startedAsync();
    monitor.setVisible(KEY, true);
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(1);
    await repository.writeAsync("a.txt", "changed\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Changed"]);

    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(2);

    assert.deepEqual(changes, [[KEY, 1], [KEY, 2]]);
  });

  test("watches a repository that keeps its refs in a reftable through its table list, hearing its branch move, with its cookie in the git folder only", async context => {
    context.skip(!(await repository.hasGitAsync([2, 45])), "git keeps refs in a reftable from 2.45; an older git can't make or read one.");
    const top = path.join(repository.root, "reftable");
    await repository.runGitAsync(["init", "--quiet", "--ref-format=reftable", top]);
    await repository.runGitAsync(["-C", top, "commit", "--quiet", "--allow-empty", "-m", "First"]);
    const gitFolder = path.join(top, ".git");
    monitor.watch(KEY, top, new RepositoryFolders(top, gitFolder, gitFolder), true);
    const started = await startedAsync();
    monitor.setVisible(KEY, true);
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(1);

    const tree = (await repository.runGitAsync(["-C", top, "rev-parse", "HEAD^{tree}"])).trim();
    const next = (await repository.runGitAsync(["-C", top, "commit-tree", tree, "-p", "HEAD", "-m", "Second"])).trim();
    await repository.runGitAsync(["-C", top, "update-ref", "HEAD", next]);
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(2);

    assert.deepEqual([started, changes, lines], [WatchStart.Seen, [[KEY, 1], [KEY, 2]], []]);
    assert.deepEqual([(await readdir(gitFolder)).filter(isCookie), (await readdir(path.join(gitFolder, "reftable"))).filter(isCookie)], [[], []]);
  });

  test("refuses a watch once disposed, watching no folder, so a watch asked before the part deactivated can't outlive it", async () => {
    const earlier = vi.mocked(watch).mock.results.length;
    await monitor.disposeAsync();

    monitor.watch(KEY, repository.folder, folders());
    monitor.setVisible(KEY, true);

    assert.deepEqual([await monitor.startedAsync(KEY), vi.mocked(watch).mock.results.length - earlier, waits.length], [WatchStart.Stopped, 0, 0]);
  });

  test("refreshes for packed-refs, but not for a lock file among the branches or another file in the git folder", async () => {
    const earlier = vi.mocked(watch).mock.results.length;
    monitor.watch(KEY, repository.folder, folders());
    const [own, branches, packed] = watchersOf(earlier);
    assert.ok(own !== undefined && branches !== undefined && packed !== undefined);
    assert.equal(await startedAsync(), WatchStart.Seen);
    const lock = seenAsync(branches, t => t === "feature.lock");
    await writeFile(path.join(repository.gitFolder, "refs", "heads", "feature.lock"), "lock\n");
    await lock;
    const other = Promise.all([seenAsync(own, t => t === "description"), seenAsync(packed, t => t === "description")]);
    await writeFile(path.join(repository.gitFolder, "description"), "other\n");
    await other;
    const before = waits.filter(t => t.milliseconds === DEBOUNCE).length;

    await writeFile(path.join(repository.gitFolder, "packed-refs"), "# pack-refs with: peeled fully-peeled sorted\n");
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(1);

    assert.deepEqual([before, changes], [0, [[KEY, 1]]]);
  });

  test("refreshes when the file system names no file for a change", async () => {
    const earlier = vi.mocked(watch).mock.results.length;
    monitor.watch(KEY, repository.folder, folders());
    const [own] = watchersOf(earlier);
    assert.ok(own !== undefined);
    await startedAsync();

    own.emit("change", "rename", null);
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(1);

    assert.deepEqual(changes, [[KEY, 1]]);
  });

  test("announces the module's own write at once without reading the status, and holds back the refreshes its changes start while it runs", async () => {
    monitor.watch(KEY, repository.folder, folders());
    await startedAsync();
    const reads = (): number => supervisor.requests.filter(t => t.arguments.includes("status")).length;
    const earlier = waits.length;

    monitor.notifyWriting(KEY);
    monitor.setVisible(KEY, true);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Written"]);
    const during = [changes.length, reads(), waits.slice(earlier).map(t => t.milliseconds)];
    monitor.notifyWritten(KEY);

    assert.deepEqual([during, changes, reads()], [[0, 0, [POLL]], [[KEY, 1]], 0]);
  });

  test("skips a refresh a write began during its wait, drops a status read a write began during, and ignores writes to a key it doesn't watch", async () => {
    monitor.watch(KEY, repository.folder, folders());
    await startedAsync();
    monitor.notifyWriting(OTHER);
    monitor.notifyWritten(OTHER);
    const original = StatusReader.prototype.readAsync;
    const reads = vi.spyOn(StatusReader.prototype, "readAsync");
    monitor.setVisible(KEY, true);
    const held = await nextWaitAsync(DEBOUNCE);
    monitor.notifyWriting(KEY);
    held.fire();
    await new Promise<void>(resolve => setImmediate(resolve));
    const skipped = reads.mock.calls.length;
    monitor.notifyWritten(KEY);
    const hooked = Promise.withResolvers<void>();
    reads.mockImplementation(async function (this: StatusReader, ...values: Parameters<StatusReader["readAsync"]>) {
      monitor.notifyWriting(KEY);
      try {
        return await original.apply(this, values);
      } finally {
        hooked.resolve();
      }
    });
    monitor.setVisible(KEY, false);
    monitor.setVisible(KEY, true);
    await fireNextAsync(DEBOUNCE);
    await hooked.promise;
    await monitor.disposeAsync();

    assert.deepEqual([monitor.generationOf(OTHER), skipped, reads.mock.calls.length > 0, changes], [0, 0, true, [[KEY, 1]]]);
  });

  test("stays quiet when a refresh after a write finds the status a read took once the write ended, but not one a read took while it ran", async () => {
    monitor.watch(KEY, repository.folder, folders());
    await startedAsync();
    const statuses = new StatusReader(new ProgramRunner(supervisor.context));
    const spanning = monitor.generationOf(KEY);
    monitor.notifyWriting(KEY);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Written"]);
    monitor.notifyWritten(KEY);
    monitor.observe(KEY, spanning, (await statuses.readAsync(folders())).fingerprint);
    monitor.setVisible(KEY, true);
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(2);

    monitor.notifyWriting(KEY);
    await repository.runGitAsync(["commit", "--quiet", "--allow-empty", "-m", "Written again"]);
    monitor.notifyWritten(KEY);
    monitor.observe(KEY, monitor.generationOf(KEY), (await statuses.readAsync(folders())).fingerprint);
    await fireNextAsync(POLL);
    await fireNextAsync(DEBOUNCE);
    await monitor.disposeAsync();

    assert.deepEqual(changes, [[KEY, 1], [KEY, 2], [KEY, 3]]);
  });

  test("polls while the pane is visible, finding a further edit to a changed file, and stops when it is hidden, once however often", async () => {
    monitor.watch(KEY, repository.folder, folders());
    await startedAsync();
    const earlier = waits.length;
    monitor.setVisible(KEY, true);
    monitor.setVisible(KEY, true);
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(1);
    await repository.writeAsync("a.txt", "changed once\n");
    await fireNextAsync(POLL);
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(2);
    await repository.writeAsync("a.txt", "changed twice, longer\n");
    await fireNextAsync(POLL);
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(3);
    const poll = await nextWaitAsync(POLL);

    monitor.setVisible(KEY, false);
    monitor.setVisible(KEY, false);
    await monitor.disposeAsync();

    assert.deepEqual(changes, [[KEY, 1], [KEY, 2], [KEY, 3]]);
    assert.deepEqual([poll.isCleared, waits.slice(earlier).filter(t => t.milliseconds === POLL).length], [true, 3]);
    const statuses = supervisor.requests.filter(t => t.arguments.includes("status"));
    assert.equal(statuses.length, 3);
    assert.ok(statuses.every(t => t.arguments.includes("--no-optional-locks")));
  });

  test("forgets an unwatched worktree and ends its waits", async () => {
    monitor.watch(KEY, repository.folder, folders());
    await startedAsync();
    const earlier = waits.length;
    monitor.setVisible(KEY, true);
    const debounce = await nextWaitAsync(DEBOUNCE);
    const poll = await nextWaitAsync(POLL);

    monitor.unwatch(KEY);
    monitor.notifyWritten(KEY);
    monitor.setVisible(KEY, false);
    await monitor.disposeAsync();

    assert.deepEqual([changes, debounce.isCleared, poll.isCleared, waits.length, supervisor.requests.length], [[], true, true, earlier + 2, 0]);
  });

  test("announces a refresh that finds the repository moved on from the first read after a write, though a later read found it there", async () => {
    monitor.watch(KEY, repository.folder, folders());
    await startedAsync();
    const statuses = new StatusReader(new ProgramRunner(supervisor.context));
    monitor.setVisible(KEY, true);
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(1);

    monitor.notifyWriting(KEY);
    monitor.notifyWritten(KEY);
    const generation = monitor.generationOf(KEY);
    monitor.observe(KEY, generation, "read while the checkout settled");
    monitor.observe(KEY, generation, (await statuses.readAsync(folders())).fingerprint);
    await fireNextAsync(POLL);
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(3);

    assert.deepEqual(changes, [[KEY, 1], [KEY, 2], [KEY, 3]]);
  });

  test("waits on disposal for a refresh that ends after its worktree is unwatched, neither announcing nor logging it", async () => {
    monitor.watch(KEY, repository.folder, folders());
    await startedAsync();
    monitor.setVisible(KEY, true);
    const started = supervisor.waitForStartAsync();
    await fireNextAsync(DEBOUNCE);
    await started;

    monitor.unwatch(KEY);
    await monitor.disposeAsync();

    assert.deepEqual([changes, lines, supervisor.events.map(t => t.split(" ")[0])], [[], [], ["start", "exit"]]);
  });

  test("drops a refresh that a write starts or ends during, leaving the write's own announcement", async () => {
    monitor.watch(KEY, repository.folder, folders());
    await startedAsync();
    monitor.setVisible(KEY, true);
    const started = supervisor.waitForStartAsync();
    await fireNextAsync(DEBOUNCE);
    await started;
    monitor.notifyWriting(KEY);
    monitor.notifyWritten(KEY);

    await monitor.disposeAsync();

    assert.deepEqual(changes, [[KEY, 1]]);
  });

  test("logs a watcher's error with its folder, never the key, and closes it", async () => {
    const earlier = vi.mocked(watch).mock.results.length;
    monitor.watch(KEY, repository.folder, folders());
    await startedAsync();
    const [watcher] = watchersOf(earlier);
    assert.ok(watcher !== undefined);
    const close = vi.spyOn(watcher, "close");

    watcher.emit("error", new Error("The folder went away."));

    assert.deepEqual(lines, [`Couldn't watch ${repository.gitFolder}, so the module checks the worktree for changes every few seconds instead: Error: The folder went away.`]);
    assert.equal(close.mock.calls.length, 1);
    assert.equal(waits.filter(t => t.milliseconds === POLL && !t.isCleared).length, 1);
    close.mockRestore();
    watcher.close();
  });

  test("logs a folder it can't watch and a status it can't read, and keeps going", async () => {
    const missing = path.join(repository.root, "missing");
    monitor.watch(KEY, missing, new RepositoryFolders(missing, missing, missing));

    monitor.setVisible(KEY, true);
    await fireNextAsync(DEBOUNCE);
    await untilLinesAsync(4);
    monitor.setVisible(KEY, false);

    assert.deepEqual(changes, []);
    assert.equal(lines.filter(t => t.startsWith(`Couldn't watch ${missing}`)).length, 3);
    assert.equal(lines.filter(t => t.startsWith(`Couldn't refresh the status of the worktree at ${missing}: `)).length, 1);
    assert.equal(lines.some(t => t.includes("QA-KEY")), false);
    assert.equal(waits.filter(t => t.milliseconds === POLL && !t.isCleared).length, 1);
    assert.equal(await startedAsync(), WatchStart.Backstop);
  });

  test("starts once it hears its cookie in the git folder and among the branches, leaving neither, so a commit right after the start is heard", async () => {
    const earlier = vi.mocked(watch).mock.results.length;
    monitor.watch(KEY, repository.folder, folders());
    const [own, branches] = watchersOf(earlier);
    assert.ok(own !== undefined && branches !== undefined);
    const heard: string[] = [];
    void seenAsync(own, isCookie).then(() => heard.push("git folder"));
    void seenAsync(branches, isCookie).then(() => heard.push("branches"));

    const start = await startedAsync();
    const left = await cookiesAsync();
    await repository.writeAsync("a.txt", "changed right after the start");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Changed"]);
    await fireNextAsync(DEBOUNCE);
    await untilChangesAsync(1);

    assert.deepEqual([start, heard.sort(), left, changes, lines], [WatchStart.Seen, ["branches", "git folder"], [[], []], [[KEY, 1]], []]);
  });

  test("counts a watch whose cookie it never hears as started at the poll's first tick and logs the folder, leaving the live cookie out of git's status and another watch's cleanup", async () => {
    const earlier = vi.mocked(watch).mock.results.length;
    monitor.watch(KEY, repository.folder, folders());
    const [own, branches] = watchersOf(earlier);
    assert.ok(own !== undefined && branches !== undefined);
    own.removeAllListeners("change");
    await touchingAsync(seenAsync(branches, isCookie));
    const live = await cookiesAsync();
    const status = await new StatusReader(new ProgramRunner(supervisor.context)).readAsync(folders());
    monitor.watch(OTHER, repository.folder, folders());
    const other = await startedAsync(OTHER);
    const kept = await cookiesAsync();

    await fireNextAsync(POLL);
    const start = await startedAsync();

    assert.deepEqual([live.map(t => t.length), status.entries.some(t => t.path.includes("noldova-watch")), other, kept, start], [[1, 1], false, WatchStart.Seen, live, WatchStart.Backstop]);
    assert.deepEqual([lines, await cookiesAsync()], [[`Didn't hear the watch of ${repository.gitFolder} start within a few seconds, so the module counts it as started and checks the worktree every few seconds while it is shown.`], [[], []]]);
  });

  test("hears a cookie whose first event the file system lost, as macOS's shared event stream does while it restarts, by writing the cookie again", async () => {
    const { watch: realWatch } = await vi.importActual<typeof import("node:fs")>("node:fs");
    const earlier = vi.mocked(watch).mock.calls.length;
    const writes = vi.mocked(writeFile).mock.calls.length;
    const cookieWrites = (): number => vi.mocked(writeFile).mock.calls.slice(writes)
      .filter(([file]) => typeof file === "string" && file.startsWith(path.join(repository.gitFolder, "noldova-watch-"))).length;
    let lost = 0;
    vi.mocked(watch).mockImplementationOnce((folder: PathLike, _options: unknown, listener?: WatchListener<string>) =>
      realWatch(folder, { persistent: false }, (event, name) => {
        if (name !== null && isCookie(name) && (lost === 0 || cookieWrites() < 2)) {
          lost++;
          return;
        }
        listener?.(event, name);
      }));
    monitor.watch(KEY, repository.folder, folders());
    assert.deepEqual(vi.mocked(watch).mock.calls[earlier]?.slice(0, 2), [repository.gitFolder, { persistent: false }]);

    const starting = monitor.startedAsync(KEY);
    await fireNextAsync(TOUCH);
    const start = await touchingAsync(starting);

    assert.deepEqual([start, lines, await cookiesAsync()], [WatchStart.Seen, [], [[], []]]);
    assert.ok(lost >= 1 && cookieWrites() >= 2, `${String(lost)} lost cookie events and ${String(cookieWrites())} cookie writes`);
  });

  test("keeps writing a cookie it can't write again until the poll's first tick, and fails on any other error writing it", async () => {
    const touched: unknown[] = [];
    const watchUnheardAsync = async (): Promise<(typeof waits)[number]> => {
      const earlier = vi.mocked(watch).mock.results.length;
      const writes = vi.mocked(writeFile).mock.calls.length;
      monitor.watch(KEY, repository.folder, folders());
      const [own, branches] = watchersOf(earlier);
      assert.ok(own !== undefined && branches !== undefined);
      own.removeAllListeners("change");
      const touch = await nextWaitAsync(TOUCH);
      const branchCookie = vi.mocked(writeFile).mock.calls.slice(writes).map(([file]) => String(file)).find(t => path.dirname(t) === branchesFolder());
      assert.ok(branchCookie !== undefined);
      branches.emit("change", "rename", path.basename(branchCookie));
      return touch;
    };
    const failTouchAsync = async (touch: (typeof waits)[number], error: Error): Promise<void> => {
      const { promise, resolve } = Promise.withResolvers<void>();
      // The module's functions are spies over Node's own, so only the touch's write is replaced, once.
      vi.mocked(writeFile).mockImplementationOnce(async file => {
        touched.push(file);
        resolve();
        throw error;
      });
      touch.fire();
      await touchingAsync(promise);
    };
    await failTouchAsync(await watchUnheardAsync(), Object.assign(new Error("denied"), { code: "EACCES" }));
    await fireNextAsync(POLL);
    const denied = await startedAsync();
    const deniedLines = [...lines];
    const broken = Object.assign(new Error("broken"), { code: "EIO" });
    await failTouchAsync(await watchUnheardAsync(), broken);

    await assert.rejects(touchingAsync(monitor.startedAsync(KEY)), broken);
    assert.deepEqual(touched.map(t => path.dirname(String(t))), [repository.gitFolder, repository.gitFolder]);
    assert.deepEqual([denied, deniedLines, await cookiesAsync()],
      [WatchStart.Backstop, [`Didn't hear the watch of ${repository.gitFolder} start within a few seconds, so the module counts it as started and checks the worktree every few seconds while it is shown.`], [[], []]]);
  });

  test("counts a watch whose cookie it can't write as started at the poll's first tick and logs the folder, skips a folder it can't list, and fails on any other error", async () => {
    const earlier = vi.mocked(watch).mock.results.length;
    vi.mocked(writeFile).mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "EACCES" }));
    monitor.watch(KEY, repository.folder, folders());
    const [, branches] = watchersOf(earlier);
    assert.ok(branches !== undefined);
    await touchingAsync(seenAsync(branches, isCookie));
    await fireNextAsync(POLL);
    const denied = await startedAsync();
    const left = await cookiesAsync();
    await writeFile(path.join(repository.gitFolder, "noldova-watch-x"), "");
    vi.mocked(readdir).mockRejectedValueOnce(Object.assign(new Error("gone"), { code: "ENOENT" }));
    monitor.watch(KEY, repository.folder, folders());
    const unlisted = await startedAsync();
    const unlistedLeft = await cookiesAsync();
    const broken = Object.assign(new Error("broken"), { code: "EIO" });
    vi.mocked(writeFile).mockRejectedValueOnce(broken);
    monitor.watch(KEY, repository.folder, folders());
    const unwritten = touchingAsync(monitor.startedAsync(KEY));
    await assert.rejects(unwritten, broken);
    vi.mocked(readdir).mockRejectedValueOnce(broken);
    monitor.watch(KEY, repository.folder, folders());

    await assert.rejects(touchingAsync(monitor.startedAsync(KEY)), broken);
    assert.deepEqual([denied, left, unlisted, unlistedLeft, await cookiesAsync()], [WatchStart.Backstop, [[], []], WatchStart.Seen, [["noldova-watch-x"], []], [[], []]]);
    assert.deepEqual(lines, [`Couldn't write the file that confirms the watch of ${repository.gitFolder} has started, so the module counts it as started within a few seconds: Error: denied`]);
  });

  test("removes only the cookies an earlier run left behind before it starts", async () => {
    await writeFile(path.join(repository.gitFolder, "noldova-watch-x"), "");
    await writeFile(path.join(branchesFolder(), "noldova-watch-y.lock"), "");
    await writeFile(path.join(repository.gitFolder, "noldova-watch-q.lock"), "");
    await writeFile(path.join(repository.gitFolder, "noldova-watched"), "");
    await repository.runGitAsync(["branch", "noldova-watch-z"]);

    monitor.watch(KEY, repository.folder, folders());
    const start = await startedAsync();

    const named = async (folder: string): Promise<string[]> => (await readdir(folder)).filter(t => t.startsWith("noldova-watch")).sort();
    assert.deepEqual([start, await named(repository.gitFolder), await named(branchesFolder())], [WatchStart.Seen, ["noldova-watch-q.lock", "noldova-watched"], ["noldova-watch-z"]]);
  });

  test("counts a watch stopped before it starts as stopped, leaving no cookie, and knows no start for a worktree it doesn't watch", async () => {
    monitor.watch(KEY, repository.folder, folders());
    const start = monitor.startedAsync(KEY);

    monitor.unwatch(KEY);

    assert.deepEqual([await start, await monitor.startedAsync(KEY), lines, await cookiesAsync()], [WatchStart.Stopped, WatchStart.Stopped, [], [[], []]]);
  });
});
