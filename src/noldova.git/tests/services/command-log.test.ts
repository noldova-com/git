/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, test } from "vitest";

import { CommandLog } from "../../src/services/command-log.ts";

describe("CommandLog", () => {
  test("logs each repository's commands apart, with when each started, how it ended and how long it took, keeping the last 200", () => {
    let now = Date.parse("2026-11-22T18:05:00.250Z");
    const log = new CommandLog(() => new Date(now));

    const push = log.start("/work/a/.git", ["push", "origin", "main:refs/heads/main"]);
    now += 840;
    push(0);
    log.start("/work/b/.git", ["fetch"])(null);
    for (let index = 0; index < 200; index++)
      log.start("/work/c/.git", ["add", String(index)])(0);

    assert.deepEqual(log.read("/work/a/.git").toJson(), {
      commands: [{ id: "1", at: "2026-11-22T18:05:00Z", line: "git push origin main:refs/heads/main", exitCode: 0, milliseconds: 840 }]
    });
    assert.deepEqual(log.read("/work/b/.git").commands.map(t => [t.line, t.exitCode]), [["git fetch", null]]);
    assert.deepEqual([log.read("/work/c/.git").commands.length, log.read("/work/c/.git").commands[0]?.line, log.read("/work/none/.git").commands], [200, "git add 0", []]);
  });

  test("takes a clock that moves back as no time", () => {
    let now = Date.parse("2026-11-22T18:05:00Z");
    const log = new CommandLog(() => new Date(now));
    const finish = log.start("/work/a/.git", ["fetch"]);
    now -= 5_000;
    finish(0);

    assert.equal(log.read("/work/a/.git").commands[0]?.milliseconds, 0);
  });

  test("writes the line as the person could type it: without the module's settings or end-of-options, quoting where needed, with no URL secret or control character", () => {
    assert.deepEqual([
      CommandLog.lineOf(["-c", "core.fsmonitor=false", "-c", "filter.lfs.clean=", "push", "origin", "--end-of-options", "a:refs/heads/a"]),
      CommandLog.lineOf(["commit", "--message=Fix the \"graph\" view", "--", "a b.txt", ""]),
      CommandLog.lineOf(["push", "https://name:secret@host.example/team/repo.git", "main"]),
      CommandLog.lineOf(["commit", "--message=First\n\nBody"])
    ], [
      "git push origin a:refs/heads/a",
      "git commit \"--message=Fix the \\\"graph\\\" view\" -- \"a b.txt\" \"\"",
      "git push https://host.example/team/repo.git main",
      "git commit \"--message=First��Body\""
    ]);
  });

  test("cuts a line past 1000 characters to 999 and an ellipsis", () => {
    const line = CommandLog.lineOf(["commit", `--message=${"a".repeat(2_000)}`]);

    assert.deepEqual([line.length, line.endsWith("a…")], [1000, true]);
  });
});
