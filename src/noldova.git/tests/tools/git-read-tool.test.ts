/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { ToolCall, ToolFailureCode, ToolFailureException, ToolRisk } from "@noldova/desktop.runtime";

import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { KeyQueue } from "../../src/services/key-queue.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { GitReadTool } from "../../src/tools/git-read-tool.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("GitReadTool", () => {
  const descriptor = {
    name: "git_read",
    title: "Read",
    description: "Reads.",
    inputSchema: { type: "object" },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    deadline: { default: 60_000, maximum: 60_000 }
  };
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  let supervisor: DesktopFixture;
  let repositories: RepositoryReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    const runner = new ProgramRunner(supervisor.context);
    repositories = new RepositoryReader(runner, new GitVersionReader(runner));
  });

  afterEach(async () => {
    await supervisor.disposeAsync();
    await repository.disposeAsync();
  });

  const callOf = (folder: string): ToolCall => new ToolCall("session-1", "conversation-1", { "git.folder": folder }, {}, Date.now() + 60_000, new AbortController().signal);
  const failureOf = (code: ToolFailureCode, moduleCode: string): ((error: unknown) => boolean) => (error: unknown): boolean =>
    error instanceof ToolFailureException && error.failure.code === code && error.failure.moduleCode === moduleCode;

  test("answers the read's text for the bound repository's folders as the repository's untrusted text", async () => {
    const seen: string[] = [];
    const tool = new GitReadTool(descriptor, repositories, new KeyQueue(), async (folders: RepositoryFolders) => {
      seen.push(folders.top);
      return "{}";
    });

    const result = await tool.handleAsync(callOf(repository.folder));

    assert.deepEqual([seen, result.content.map(t => [t.value, t.origin, t.isUntrusted])], [[repository.folder], [["{}", "git:repository", true]]]);
  });

  test("fails a folder outside any repository as NotRepository, and a text that can't fit as TooLarge", async () => {
    const tool = new GitReadTool(descriptor, repositories, new KeyQueue(), async () => null);

    await assert.rejects(tool.handleAsync(callOf(repository.root)), failureOf(ToolFailureCode.Refused, "git.notRepository"));
    await assert.rejects(tool.handleAsync(callOf(repository.folder)), failureOf(ToolFailureCode.TooLarge, "git.tooLarge"));
  });
});
