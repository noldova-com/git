/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { Access } from "../../src/enums/access.ts";
import { GitArguments } from "../../src/models/git-arguments.ts";
import { ProgramLimits } from "../../src/models/program-limits.ts";
import { ProgramRequest } from "../../src/models/program-request.ts";
import { ProgramRun } from "../../src/models/program-run.ts";

describe("ProgramRequest", () => {
  const limits = new ProgramLimits(1, 1);
  const signal = new AbortController().signal;

  test("every run sets the C locale, no prompts and no pager, only a read takes pathspecs literally through the environment, and inherits only the named variables", () => {
    const request = new ProgramRequest(ProgramRun.runGh(Access.Write, ["pr", "create"], "/work", limits), signal);
    const read = new ProgramRequest(ProgramRun.runGh(Access.Read, ["pr", "view"], "/work", limits), signal);

    assert.deepEqual(request.environment, {
      LC_ALL: "C",
      GIT_TERMINAL_PROMPT: "0",
      GH_PROMPT_DISABLED: "1",
      GCM_INTERACTIVE: "never",
      GIT_PAGER: "cat"
    });
    assert.deepEqual(read.environment, { ...request.environment, GIT_LITERAL_PATHSPECS: "1" });
    assert.deepEqual(request.inherit, [
      "HOME",
      "HOMEDRIVE",
      "HOMEPATH",
      "APPDATA",
      "LOCALAPPDATA",
      "XDG_CONFIG_HOME",
      "SSH_AUTH_SOCK",
      "DBUS_SESSION_BUS_ADDRESS",
      "GH_CONFIG_DIR",
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "NO_PROXY",
      "http_proxy",
      "https_proxy",
      "no_proxy"
    ]);
    assert.equal(request.program, "gh");
    assert.deepEqual(request.arguments, ["pr", "create"]);
    assert.equal(request.workingFolder, "/work");
    assert.equal(request.signal, signal);
  });

  test("a git run turns fsmonitor off first, and only a read takes --no-optional-locks", () => {
    const read = new ProgramRequest(ProgramRun.readGit(new GitArguments(["status"]), "/work", limits), signal);
    const write = new ProgramRequest(ProgramRun.writeGit(new GitArguments(["add"]), "/work", "/work/.git", "/work/.git", limits), signal);

    assert.equal(read.program, "git");
    assert.deepEqual(read.arguments, ["-c", "core.fsmonitor=false", "--no-optional-locks", "status"]);
    assert.deepEqual(write.arguments, ["-c", "core.fsmonitor=false", "add"]);
  });
});
