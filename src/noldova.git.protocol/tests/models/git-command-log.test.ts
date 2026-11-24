/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { GitCommand } from "../../src/models/git-command.ts";
import { GitCommandLog } from "../../src/models/git-command-log.ts";

describe("GitCommand", () => {
  const json = { id: "1", at: "2026-11-22T18:05:00Z", line: "git push origin main:refs/heads/main", exitCode: 0, milliseconds: 840 };

  it("keeps its id, start, command line, exit code and time, and reads back the same, also with no exit code", () => {
    const command = new GitCommand("1", "2026-11-22T18:05:00Z", "git push origin main:refs/heads/main", 0, 840);
    const stopped = new GitCommand("2", "2026-11-22T18:05:00+02:00", "git fetch --prune origin", null, 30_000);

    assert.deepEqual(command.toJson(), json);
    assert.deepEqual([GitCommand.fromJson(JSON.parse(JSON.stringify(command.toJson()))), GitCommand.fromJson(stopped.toJson())], [command, stopped]);
  });

  it("refuses an empty or multi-line id or line, a time that isn't ISO 8601, a fractional exit code, a negative time, and an unknown or missing field, naming its path", () => {
    assert.throws(() => GitCommand.fromJson({ ...json, id: "" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitCommand.fromJson({ ...json, id: "1\n2" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitCommand.fromJson({ ...json, at: "2026-11-22 18:05" }), { name: "ProtocolFieldException", field: "$.at" });
    assert.throws(() => GitCommand.fromJson({ ...json, at: "2026-13-45T18:05:00Z" }), { name: "ProtocolFieldException", field: "$.at" });
    assert.throws(() => GitCommand.fromJson({ ...json, line: "" }), { name: "ProtocolFieldException", field: "$.line" });
    assert.throws(() => GitCommand.fromJson({ ...json, line: "git commit\u001b[2J" }), { name: "ProtocolFieldException", field: "$.line" });
    assert.throws(() => new GitCommand("1", json.at, json.line, 1.5, 0), { name: "ProtocolFieldException", field: "exitCode" });
    assert.throws(() => GitCommand.fromJson({ ...json, milliseconds: -1 }), { name: "ProtocolFieldException", field: "$.milliseconds" });
    assert.throws(() => GitCommand.fromJson({ ...json, more: 1 }), { name: "ProtocolFieldException" });
    const { exitCode: _exitCode, ...missing } = json;
    assert.throws(() => GitCommand.fromJson(missing), { name: "JsonException", path: "$.exitCode" });
  });
});

describe("GitCommandLog", () => {
  const commandOf = (id: number): GitCommand => new GitCommand(String(id), "2026-11-22T18:05:00Z", "git fetch", 0, 10);

  it("keeps up to 200 commands, reads them back the same, and refuses a 201st, an invalid command and an unknown field", () => {
    const log = new GitCommandLog(Array.from({ length: 200 }, (_, index) => commandOf(index)));

    assert.deepEqual([GitCommandLog.fromJson(log.toJson()), new GitCommandLog([]).toJson()], [log, { commands: [] }]);
    assert.throws(() => GitCommandLog.fromJson({ commands: Array.from({ length: 201 }, (_, index) => commandOf(index).toJson()) }),
      { name: "ProtocolFieldException", field: "$.commands" });
    assert.throws(() => GitCommandLog.fromJson({ commands: [{ ...commandOf(1).toJson(), line: "" }] }), { name: "ProtocolFieldException", field: "$.commands.0.line" });
    assert.throws(() => GitCommandLog.fromJson({ commands: [], more: 1 }), { name: "ProtocolFieldException" });
  });
});
