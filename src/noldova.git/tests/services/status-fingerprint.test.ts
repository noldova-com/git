/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, test } from "vitest";

import { FileState, StatusEntry } from "@noldova/git.protocol";

import { ParsedStatus } from "../../src/models/parsed-status.ts";
import { StatusFingerprint } from "../../src/services/status-fingerprint.ts";

describe("StatusFingerprint", () => {
  let folder: string;
  let gitFolder: string;
  const statusOf = (file: string, truncated: boolean = false): ParsedStatus =>
    new ParsedStatus("main", null, null, [new StatusEntry(file, undefined, null, undefined, FileState.Unmodified, FileState.Modified, null, null, null, null)], truncated);

  beforeAll(async () => {
    folder = await mkdtemp(path.join(tmpdir(), "status-fingerprint-"));
    gitFolder = path.join(folder, ".git");
    await mkdir(gitFolder);
    await writeFile(path.join(folder, "a.txt"), "a\n");
  });

  afterAll(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  test("tells a changed file from a missing one, and reads a missing index or file as missing", async () => {
    const present = await StatusFingerprint.readAsync(folder, gitFolder, Buffer.alloc(0), statusOf("a.txt"));
    const missing = await StatusFingerprint.readAsync(folder, gitFolder, Buffer.alloc(0), statusOf("gone.txt"));

    assert.match(present, /^[0-9a-f]{64}$/v);
    assert.notEqual(present, missing);
    assert.equal(await StatusFingerprint.readAsync(folder, gitFolder, Buffer.alloc(0), statusOf("gone.txt")), missing);
  });

  test("moves with git's output, a cut status, the index and a changed file's size", async () => {
    const readAsync = (output: string, truncated: boolean = false): Promise<string> => StatusFingerprint.readAsync(folder, gitFolder, Buffer.from(output), statusOf("a.txt", truncated));
    const seen = [await readAsync(""), await readAsync("1 .M"), await readAsync("", true)];
    await writeFile(path.join(gitFolder, "index"), "index");
    seen.push(await readAsync(""));
    await writeFile(path.join(folder, "a.txt"), "a longer\n");
    seen.push(await readAsync(""));

    assert.equal(new Set(seen).size, 5);
    assert.equal(await readAsync(""), seen[4]);
  });

  test("fails on a file it can't stat for a reason other than its absence, rather than reading it as missing", async () => {
    await assert.rejects(StatusFingerprint.readAsync(folder, gitFolder, Buffer.alloc(0), statusOf(`bad${String.fromCharCode(0)}name`)), { code: "ERR_INVALID_ARG_VALUE" });
  });
});
