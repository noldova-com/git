/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, open, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import timers from "node:timers";

import { afterEach, beforeEach, describe, onTestFinished, test, vi } from "vitest";

import { FailureCode } from "@noldova/git.protocol";

import { ChangesUnreadableException } from "../../src/exceptions/changes-unreadable.exception.ts";
import { Resources } from "../../src/resources.ts";
import { ChangesDigest } from "../../src/services/changes-digest.ts";

vi.mock(import("node:fs/promises"), { spy: true });

describe("ChangesDigest", () => {
  const status = Buffer.from("? a.txt\0");
  let folder: string;
  const paths = (...names: string[]): Buffer[] => names.map(t => Buffer.from(t));
  const digest = new ChangesDigest(Resources.changesDigestBytes);
  const readAsync = (...names: string[]): Promise<string> => digest.readAsync(folder, status, paths(...names));

  beforeEach(async () => {
    folder = await mkdtemp(path.join(tmpdir(), "changes-digest-"));
    await mkdir(path.join(folder, "sub"));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  test("gives the same digest while nothing changes, as hexadecimal SHA-256", async () => {
    await writeFile(path.join(folder, "a.txt"), "a\n");

    const first = await readAsync("a.txt");

    assert.match(first, /^[0-9a-f]{64}$/v);
    assert.equal(await readAsync("a.txt"), first);
  });

  test("changes with the status, with a file's content, and when a file goes missing", async () => {
    await writeFile(path.join(folder, "a.txt"), "a\n");
    const first = await readAsync("a.txt");

    assert.notEqual(await digest.readAsync(folder, Buffer.from("? b.txt\0"), paths("a.txt")), first);
    await writeFile(path.join(folder, "a.txt"), "b\n");
    assert.notEqual(await readAsync("a.txt"), first);
    await rm(path.join(folder, "a.txt"));
    assert.notEqual(await readAsync("a.txt"), first);
    assert.equal(await readAsync("a.txt"), await readAsync("a.txt"));
  });

  test("keeps the paths apart, so moving content between two files changes it", async () => {
    await writeFile(path.join(folder, "x.txt"), "x");
    await writeFile(path.join(folder, "y.txt"), "xy");
    const first = await readAsync("x.txt", "y.txt");

    await writeFile(path.join(folder, "x.txt"), "xx");
    await writeFile(path.join(folder, "y.txt"), "y");

    assert.notEqual(await readAsync("x.txt", "y.txt"), first);
  });

  test("binds a link's target without following it, and a folder by the status alone", async () => {
    await symlink(path.join(folder, "sub"), path.join(folder, "link"), "junction");
    const first = await readAsync("link", "sub", "sub/missing/deeper");

    await writeFile(path.join(folder, "sub", "inside.txt"), "inside\n");

    assert.equal(await readAsync("link", "sub", "sub/missing/deeper"), first);
  });

  test("fails as too large past the byte limit it was made with, counting every file", async () => {
    await writeFile(path.join(folder, "x.txt"), "x");
    await writeFile(path.join(folder, "y.txt"), "xy");

    assert.match(await new ChangesDigest(3).readAsync(folder, status, paths("x.txt", "y.txt")), /^[0-9a-f]{64}$/v);
    await assert.rejects(new ChangesDigest(2).readAsync(folder, status, paths("x.txt", "y.txt")), {
      name: "ChangesTooLargeException",
      code: FailureCode.TooLarge,
      message: "The worktree has more changes than the module reads, so it can't ask to remove it."
    });
  });

  test("fails as timed out when its deadline passes while it reads", async () => {
    await writeFile(path.join(folder, "a.txt"), "a\n");
    const original = timers.setTimeout;
    const timer = vi.spyOn(timers, "setTimeout").mockImplementation((...values: Parameters<typeof timers.setTimeout>) => {
      const [handler, delay] = values;
      if (delay === Resources.changesDigestMilliseconds && typeof handler === "function")
        handler();
      return original(...values);
    });
    onTestFinished(() => timer.mockRestore());

    await assert.rejects(readAsync("a.txt"), {
      name: "ChangesTooSlowException",
      code: FailureCode.TimedOut,
      message: "The worktree's changed files took too long to read, so the module can't ask to remove it."
    });
  });

  test("fails as unavailable when the file system refuses to read a changed file", async context => {
    context.skip(process.platform === "win32", "An elevated Windows run read past a deny entry for its own account, so the file system's denial is stood in there.");
    const file = path.join(folder, "a.txt");
    await writeFile(file, "a\n");
    await chmod(file, 0o000);
    let refusal: unknown;
    try {
      await readAsync("a.txt");
    } catch (error) {
      refusal = error;
    } finally {
      await chmod(file, 0o644);
    }

    assert.ok(refusal instanceof ChangesUnreadableException);
    assert.deepEqual([refusal.code, refusal.message, refusal.cause instanceof Error && "code" in refusal.cause ? refusal.cause.code : null],
      [FailureCode.Unavailable, "A changed file in the worktree can't be read, so the module can't ask to remove it.", "EACCES"]);
  });

  test("fails as unavailable on Windows too, by the file system's denial stood in, since an elevated Windows run read past a deny entry for its own account", async context => {
    context.skip(process.platform !== "win32", "Elsewhere the test above denies a real file.");
    await writeFile(path.join(folder, "a.txt"), "a\n");
    const denied = Object.assign(new Error("EACCES: permission denied, open"), { code: "EACCES", syscall: "open" });
    vi.mocked(open).mockRejectedValueOnce(denied);

    await assert.rejects(readAsync("a.txt"), {
      name: "ChangesUnreadableException",
      code: FailureCode.Unavailable,
      message: "A changed file in the worktree can't be read, so the module can't ask to remove it.",
      cause: denied
    });
  });

  test("fails with an error that isn't the file system's, rather than calling the changes unreadable", async () => {
    await assert.rejects(readAsync("bad\0name"), { name: "TypeError", code: "ERR_INVALID_ARG_VALUE" });
  });
});
