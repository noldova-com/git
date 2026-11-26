/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SQLOutputValue } from "node:sqlite";

import { describe, onTestFinished, test } from "vitest";

import { DataDirectory, ModuleDatabase } from "@noldova/desktop.runtime";
import { FakeModuleDatabase } from "@noldova/desktop.runtime/testing";
import { FailureCode, WorktreeRecord } from "@noldova/git.protocol";

import { WorktreeTable } from "../../src/services/worktree-table.ts";

describe("WorktreeTable", () => {
  const BASE = "0123456789abcdef0123456789abcdef01234567";
  const record = (key: string): WorktreeRecord => new WorktreeRecord(key, "/r", `/w/${key}`, `noldova/${key}`, BASE);
  const openDatabaseAsync = async (): Promise<ModuleDatabase> => {
    const folder = await mkdtemp(path.join(tmpdir(), "git-worktree-table-"));
    const database = await ModuleDatabase.openAsync(new DataDirectory(folder), "git", [WorktreeTable.migration]);
    onTestFinished(async () => {
      database.close();
      await rm(folder, { recursive: true, force: true });
    });
    return database;
  };
  const openAsync = async (): Promise<WorktreeTable> => new WorktreeTable(await openDatabaseAsync());

  test("keeps a record pending until it is marked ready, and forgets it", async () => {
    const table = await openAsync();
    table.insertPending(record("b"));
    table.insertPending(record("a"));

    assert.equal(table.find("b")?.isPending, true);
    table.markReady("b");
    assert.equal(table.find("b")?.isPending, false);
    assert.deepEqual(table.find("b")?.record.toJson(), record("b").toJson());
    assert.deepEqual(table.readAll().map(t => t.record.key), ["a", "b"]);
    table.delete("b");
    assert.equal(table.find("b"), null);
    assert.equal(WorktreeTable.migration.id, "create-worktrees");
  });

  test("refuses a second record for the same key or path", async () => {
    const table = await openAsync();
    table.insertPending(record("a"));

    assert.throws(() => table.insertPending(new WorktreeRecord("a", "/r", "/w/other", "noldova/other", BASE)), { code: "ERR_SQLITE_ERROR", message: "UNIQUE constraint failed: worktrees.key" });
    assert.throws(() => table.insertPending(new WorktreeRecord("b", "/r", "/w/a", "noldova/b", BASE)), { code: "ERR_SQLITE_ERROR", message: "UNIQUE constraint failed: worktrees.path" });
  });

  test("fails a row whose column doesn't hold text as Unavailable", () => {
    const row: Record<string, SQLOutputValue> = { key: 1, repository: "/r", path: "/w", branch: "b", base: BASE, state: "Ready" };
    const database = new FakeModuleDatabase();
    database.answer("readAll", () => [row]);

    assert.throws(() => new WorktreeTable(database).readAll(), {
      name: "ColumnInvalidException",
      code: FailureCode.Unavailable,
      message: "The module's worktree records hold an invalid key."
    });
  });

  test("fails a row whose state is neither Pending nor Ready as Unavailable, never as ready", async () => {
    const database = await openDatabaseAsync();
    const table = new WorktreeTable(database);
    table.insertPending(record("k"));
    database.run("PRAGMA ignore_check_constraints = ON");
    database.run("UPDATE worktrees SET state = 'Removing' WHERE key = 'k'");

    assert.throws(() => table.find("k"), {
      name: "ColumnInvalidException",
      code: FailureCode.Unavailable,
      message: "The module's worktree records hold an invalid state."
    });
  });
});
