/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { afterEach, describe, test, vi } from "vitest";

import { ToolCall, ToolFailureCode, ToolFailureException } from "@noldova/desktop.runtime";
import type { JsonObject } from "@noldova/context.json";
import { GitFolderBinding } from "@noldova/git.protocol";

import { BoundFolder } from "../../src/tools/bound-folder.ts";

describe("BoundFolder", () => {
  const callOf = (bindings: JsonObject): ToolCall => new ToolCall("session-1", "conversation-1", bindings, {}, Date.now() + 60_000, new AbortController().signal);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("reads the session's git.folder, and refuses a binding that is missing or isn't text as NoFolder", () => {
    assert.equal(BoundFolder.of(callOf({ "git.folder": "/work/project" })), "/work/project");
    for (const bindings of [{}, { "git.folder": 5 }])
      assert.throws(() => BoundFolder.of(callOf(bindings)), (error: unknown) =>
        error instanceof ToolFailureException && error.failure.code === ToolFailureCode.Refused && error.failure.moduleCode === "git.noFolder");
  });

  test("passes on a failure that isn't the binding's", () => {
    const unexpected = new RangeError("Unexpected.");
    vi.spyOn(GitFolderBinding, "fromBindings").mockImplementation(() => {
      throw unexpected;
    });

    assert.throws(() => BoundFolder.of(callOf({ "git.folder": "/work/project" })), (error: unknown) => error === unexpected);
  });

  test("answers a read's text as the repository's untrusted text, and one that can't fit even cut as TooLarge", () => {
    assert.deepEqual(BoundFolder.resultOf("{}").content.map(t => [t.value, t.origin, t.isUntrusted]), [["{}", "git:repository", true]]);
    assert.throws(() => BoundFolder.resultOf(null), (error: unknown) =>
      error instanceof ToolFailureException && error.failure.code === ToolFailureCode.TooLarge && error.failure.moduleCode === "git.tooLarge");
  });
});
