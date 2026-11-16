/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";

import { ModuleStoppingException, PermissionDecision, ToolFailure, ToolFailureCode, ToolResult, ToolRisk, type ToolSession } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import type { JsonObject } from "@noldova/git.protocol";

import { RuntimePart } from "../../src/api/index.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { FakeAnswerer } from "../fixtures/fake-answerer.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("GitWriteTool", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  let supervisor: DesktopFixture;
  let part: RuntimePart;
  let answerer: FakeAnswerer;
  let session: ToolSession;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    part = new RuntimePart();
    await part.activateAsync(supervisor.context);
    answerer = new FakeAnswerer();
    supervisor.permissions.registerAnswerer("app", answerer, new FakeModuleLog());
    session = supervisor.registry.openSession("chat-1", { "git.folder": repository.folder });
  });

  afterEach(async () => {
    await part.deactivateAsync();
    await supervisor.disposeAsync();
    await repository.disposeAsync();
  });

  const callAsync = (name: string, input: JsonObject): Promise<ToolResult | ToolFailure> => session.callAsync(name, input);

  it("answers a write that ran as done, telling the agent to read the status, when the status after it can't be read", async () => {
    await repository.writeAsync("c.txt", "new\n");
    const hook = path.join(repository.gitFolder, "hooks", "post-index-change");
    await writeFile(hook, "#!/bin/sh\nprintf 'broken' > \"$(git rev-parse --git-dir)/HEAD\"\n");
    await chmod(hook, 0o755);
    answerer.answerNext(PermissionDecision.AllowedOnce);

    const outcome = await callAsync("git_stage", { paths: ["c.txt"] });

    assert.ok(outcome instanceof ToolResult, outcome instanceof ToolFailure ? `${outcome.code} ${outcome.message}` : "");
    assert.deepEqual(outcome.content.map(t => [t.origin, t.isUntrusted]), [["git:repository", true]]);
    assert.match(outcome.content[0]?.value ?? "", /^The write is done, but the status after it couldn't be read, so read it with git_status before acting on it: /v);
    assert.deepEqual(answerer.requests.map(t => [t.action, t.risk]), [["git.stage", ToolRisk.Low]]);
  });

  it("fails a write's outcome as uncertain, never as done, when Noldova Desktop can't start the status read after it, and leaves a bug there to Desktop's own uncertain failure", async () => {
    await repository.writeAsync("c.txt", "new\n");
    await repository.writeAsync("d.txt", "new\n");
    const processes = supervisor.createContext();
    let failure: Error = new ModuleStoppingException("git", "git");
    let isWritten = false;
    supervisor.context.answer("startProcessAsync", request => {
      if (isWritten && request.arguments.includes("status"))
        return Promise.reject(failure);
      isWritten ||= request.arguments.includes("add");
      return processes.startProcessAsync(request);
    });
    answerer.answerNext(PermissionDecision.AllowedOnce, PermissionDecision.AllowedOnce);

    const stopping = await callAsync("git_stage", { paths: ["c.txt"] });
    isWritten = false;
    failure = new TypeError("A bug in the status read.");
    const bug = await callAsync("git_stage", { paths: ["d.txt"] });

    assert.ok(stopping instanceof ToolFailure && bug instanceof ToolFailure, "two ToolFailures");
    assert.deepEqual([stopping.code, stopping.moduleCode], [ToolFailureCode.OutcomeUncertain, "git.outcomeUnknown"]);
    assert.deepEqual([bug.code, bug.moduleCode], [ToolFailureCode.OutcomeUncertain, "git.internal"]);
    assert.equal(await repository.runGitAsync(["diff", "--cached", "--name-only"]), "c.txt\nd.txt\n");
  });
});
