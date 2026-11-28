/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { constants } from "node:fs";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { afterAll, beforeAll, describe, test } from "vitest";

import { FilePresence } from "../../src/services/file-presence.ts";

describe("FilePresence", () => {
  let folder: string;

  beforeAll(async () => {
    folder = await mkdtemp(path.join(tmpdir(), "file-presence-"));
    await writeFile(path.join(folder, "a.txt"), "a\n");
    await symlink(path.join(folder, "gone"), path.join(folder, "link"), "junction");
  });

  afterAll(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  test("finds a file and a folder that are there", async () => {
    assert.equal(await FilePresence.existsAsync(folder), true);
    assert.equal(await FilePresence.existsAsync(path.join(folder, "a.txt")), true);
    assert.equal(await FilePresence.existsAsync(folder, constants.R_OK | constants.X_OK), true);
  });

  test("counts a missing path, and one under a file, as gone", async () => {
    assert.equal(await FilePresence.existsAsync(path.join(folder, "missing")), false);
    assert.equal(await FilePresence.existsAsync(path.join(folder, "a.txt", "b")), false);
  });

  test("rethrows any other failure", async () => {
    await assert.rejects(FilePresence.existsAsync(`${folder}\0`), { code: "ERR_INVALID_ARG_VALUE" });
    await assert.rejects(FilePresence.entryAsync(`${folder}\0`), { code: "ERR_INVALID_ARG_VALUE" });
  });

  test("reads the entry at a path itself, a link whose target is gone included, and none where nothing is", async () => {
    const entries = await Promise.all(["a.txt", "link", "missing", path.join("a.txt", "b")].map(t => FilePresence.entryAsync(path.join(folder, t))));

    assert.deepEqual(entries.map(t => Object.isNull(t) ? null : [t.isFile(), t.isSymbolicLink()]), [[true, false], [false, true], null, null]);
  });

  test("tells only a missing path's error apart", () => {
    assert.equal(FilePresence.isGone(Object.assign(new Error("gone"), { code: "ENOENT" })), true);
    assert.equal(FilePresence.isGone(Object.assign(new Error("not a folder"), { code: "ENOTDIR" })), true);
    assert.equal(FilePresence.isGone(Object.assign(new Error("denied"), { code: "EACCES" })), false);
    assert.equal(FilePresence.isGone(new Error("no code")), false);
    assert.equal(FilePresence.isGone("ENOENT"), false);
  });

  test("tells a denied path's error apart", () => {
    assert.equal(FilePresence.isDenied(Object.assign(new Error("denied"), { code: "EACCES" })), true);
    assert.equal(FilePresence.isDenied(Object.assign(new Error("not permitted"), { code: "EPERM" })), true);
    assert.equal(FilePresence.isDenied(Object.assign(new Error("gone"), { code: "ENOENT" })), false);
    assert.equal(FilePresence.isDenied(new Error("no code")), false);
    assert.equal(FilePresence.isDenied("EACCES"), false);
  });

  test("tells apart a file the module may not or can't write", () => {
    for (const code of ["EACCES", "EPERM", "EROFS", "ENOENT"])
      assert.equal(FilePresence.isUnwritable(Object.assign(new Error("unwritable"), { code })), true);
    assert.equal(FilePresence.isUnwritable(Object.assign(new Error("broken"), { code: "EIO" })), false);
    assert.equal(FilePresence.isUnwritable(new Error("no code")), false);
    assert.equal(FilePresence.isUnwritable("EROFS"), false);
  });

  test("tells a file system call's failure apart from any other error", () => {
    assert.equal(FilePresence.isUnreadable(Object.assign(new Error("denied"), { code: "EACCES", syscall: "open" })), true);
    assert.equal(FilePresence.isUnreadable(Object.assign(new TypeError("bad path"), { code: "ERR_INVALID_ARG_VALUE" })), false);
    assert.equal(FilePresence.isUnreadable("EACCES"), false);
  });
});
