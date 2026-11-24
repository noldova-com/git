/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { WatchTable } from "../../src/services/watch-table.ts";

describe("WatchTable", () => {
  const folders = (table: WatchTable, top: string): [number, number | null, string, number][] =>
    table.watchesOf(top).map(t => [t.connection, t.window, t.folder, t.count]);
  const add = (table: WatchTable, connection: number, window: number | null, folder: string, top: string): boolean =>
    table.complete(table.begin(connection, window, folder), top);

  test("watches a repository from its first watch until its last is taken back, counting each window's watches of each folder", () => {
    const table = new WatchTable();

    assert.equal(add(table, 1, 2, "/repo", "/repo"), true);
    assert.equal(add(table, 1, 2, "/repo", "/repo"), false);
    assert.equal(add(table, 1, 3, "/repo/src", "/repo"), false);
    assert.deepEqual(folders(table, "/repo"), [[1, 2, "/repo", 2], [1, 3, "/repo/src", 1]]);

    assert.equal(table.remove(1, 2, "/repo"), null);
    assert.equal(table.remove(1, 2, "/repo"), null);
    assert.deepEqual(folders(table, "/repo"), [[1, 3, "/repo/src", 1]]);
    assert.equal(table.remove(1, 3, "/repo/src"), "/repo");
    assert.deepEqual(folders(table, "/repo"), []);
    assert.equal(add(table, 1, 3, "/repo/src", "/repo"), true);
  });

  test("forgets every window's watches of a dropped repository, so its next watch is its first and a later unwatch takes back nothing", () => {
    const table = new WatchTable();
    add(table, 1, 2, "/repo", "/repo");
    add(table, 1, 3, "/repo/src", "/repo");
    add(table, 1, 2, "/other", "/other");

    table.drop("/repo");

    assert.deepEqual([folders(table, "/repo"), table.remove(1, 3, "/repo/src"), folders(table, "/other")], [[], null, [[1, 2, "/other", 1]]]);
    assert.equal(add(table, 1, 2, "/repo", "/repo"), true);
  });

  test("changes nothing when a folder no window watches is taken back", () => {
    const table = new WatchTable();
    add(table, 1, 2, "/repo", "/repo");

    assert.equal(table.remove(1, 2, "/other"), null);
    assert.equal(table.remove(1, 4, "/repo"), null);
    assert.equal(table.remove(9, null, "/repo"), null);
    assert.deepEqual(folders(table, "/repo"), [[1, 2, "/repo", 1]]);
  });

  test("drops a closed window's watches, or every window's of a closed connection, and names the repositories no one watches", () => {
    const table = new WatchTable();
    add(table, 1, 2, "/a", "/a");
    add(table, 1, 3, "/a", "/a");
    add(table, 1, 3, "/b", "/b");
    add(table, 2, null, "/c", "/c");

    assert.deepEqual(table.removeClient(1, 3), ["/b"]);
    assert.deepEqual(folders(table, "/a"), [[1, 2, "/a", 1]]);
    assert.deepEqual(table.removeClient(2, 5), []);
    assert.deepEqual(table.removeClient(1, null), ["/a"]);
    assert.deepEqual(table.removeClient(2, null), ["/c"]);
    assert.deepEqual(table.removeClient(2, null), []);
  });

  test("cancels a watch still pending when its unwatch comes first, one unwatch for each pending watch", () => {
    const table = new WatchTable();
    const first = table.begin(1, 2, "/repo");
    const second = table.begin(1, 2, "/repo");
    const other = table.begin(1, 2, "/other");

    assert.equal(table.remove(1, 2, "/repo"), null);
    assert.equal(table.remove(1, 2, "/repo"), null);
    assert.equal(table.remove(1, 2, "/repo"), null);
    assert.equal(table.complete(first, "/repo"), false);
    assert.equal(table.complete(second, "/repo"), false);
    assert.deepEqual(folders(table, "/repo"), []);
    assert.equal(table.complete(other, "/repo"), true);
    assert.deepEqual(folders(table, "/repo"), [[1, 2, "/other", 1]]);
  });

  test("takes back a counted watch before a pending one", () => {
    const table = new WatchTable();
    add(table, 1, 2, "/repo", "/repo");
    const pending = table.begin(1, 2, "/repo");

    assert.equal(table.remove(1, 2, "/repo"), "/repo");
    assert.equal(table.complete(pending, "/repo"), true);
    assert.deepEqual(folders(table, "/repo"), [[1, 2, "/repo", 1]]);
  });

  test("cancels the pending watches of a window or connection that closes before their repository is read", () => {
    const table = new WatchTable();
    const closing = table.begin(1, 2, "/repo");
    const staying = table.begin(1, 3, "/repo");
    const connection = table.begin(4, null, "/repo");

    assert.deepEqual(table.removeClient(1, 2), []);
    assert.deepEqual(table.removeClient(4, null), []);
    assert.equal(table.complete(closing, "/repo"), false);
    assert.equal(table.complete(connection, "/repo"), false);
    assert.equal(table.complete(staying, "/repo"), true);
    assert.deepEqual(folders(table, "/repo"), [[1, 3, "/repo", 1]]);
  });

  test("forgets an abandoned watch, so a later unwatch cancels the next pending watch instead", () => {
    const table = new WatchTable();
    table.abandon(table.begin(1, 2, "/repo"));
    const next = table.begin(1, 2, "/repo");

    assert.equal(table.remove(1, 2, "/repo"), null);
    assert.equal(table.complete(next, "/repo"), false);
    assert.equal(table.complete(table.begin(1, 2, "/repo"), "/repo"), true);
    assert.deepEqual(folders(table, "/repo"), [[1, 2, "/repo", 1]]);
  });
});
