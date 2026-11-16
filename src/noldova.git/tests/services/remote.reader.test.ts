/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { FailureCode, RemoteTransport, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RemoteReader } from "../../src/services/remote.reader.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("RemoteReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  let supervisor: DesktopFixture;
  let reader: RemoteReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    reader = new RemoteReader(new ProgramRunner(supervisor.context));
  });

  afterEach(async () => {
    await supervisor.disposeAsync();
    await repository.disposeAsync();
  });

  const configureAsync = async (...lines: readonly string[]): Promise<void> => {
    await appendFile(path.join(repository.gitFolder, "config"), lines.map(t => `${t}\n`).join(""));
  };

  test("takes a remote's first URL and skips a key without a value", async () => {
    await configureAsync('[remote "origin"]', "\turl = https://host/a/one", "\turl = https://host/a/two", '[remote "flag"]', "\turl", '[branch "main"]', "\tremote = origin");

    assert.deepEqual((await reader.readAsync(repository.folder, "main"))?.toJson(), { name: "origin", host: "host", path: "a/one", transport: RemoteTransport.Https });
  });

  test("reads the only remote for a detached HEAD, and a branch's own remote only for that branch", async () => {
    await configureAsync('[remote "origin"]', "\turl = https://host/a/b");
    assert.equal((await reader.readAsync(repository.folder, null))?.name, "origin");

    await configureAsync('[remote "fork"]', "\turl = https://host/c/d", '[branch "other"]', "\tremote = fork");
    assert.equal(await reader.readAsync(repository.folder, null), null);
    assert.equal(await reader.readAsync(repository.folder, "main"), null);
    assert.equal((await reader.readAsync(repository.folder, "other"))?.name, "fork");
  });

  test("finds a remote by its name, whatever remote the branch works with, and none for a name no remote has", async () => {
    await configureAsync('[remote "origin"]', "\turl = https://host/a/b", '[remote "upstream"]', "\turl = https://host/c/d", '[branch "main"]', "\tremote = upstream");

    assert.deepEqual((await reader.readNamedAsync(repository.folder, "origin"))?.toJson(), { name: "origin", host: "host", path: "a/b", transport: RemoteTransport.Https });
    assert.equal(await reader.readNamedAsync(repository.folder, "fork"), null);
    assert.equal(await reader.readNamedAsync(repository.folder, ""), null);
  });

  test("names no remote when no remote is set, and fails with git's output when the configuration was cut or git config failed otherwise", async () => {
    await repository.runGitAsync(["remote", "add", "origin", "https://host/a/b"]);
    const runner = new ScriptedRunnerFixture(supervisor.context);
    const scripted = new RemoteReader(runner);
    const failed = { name: "GitFailedException", code: FailureCode.Unavailable, command: "config", message: "git config failed; its output comes with the failure as untrusted text." };

    assert.deepEqual([(await reader.readAsync(repository.folder, "main"))?.name, (await reader.readNamedAsync(repository.folder, "origin"))?.name],
      ["origin", "origin"]);
    runner.truncating = "--get-regexp";
    await assert.rejects(scripted.readAsync(repository.folder, "main"), failed);
    await assert.rejects(scripted.readNamedAsync(repository.folder, "origin"), failed);
    await repository.runGitAsync(["remote", "remove", "origin"]);
    assert.deepEqual([await reader.readAsync(repository.folder, "main"), await reader.readNamedAsync(repository.folder, "origin")], [null, null]);
    await configureAsync("[broken");
    for (const readAsync of [(): Promise<unknown> => reader.readAsync(repository.folder, "main"), (): Promise<unknown> => reader.readNamedAsync(repository.folder, "origin")])
      await assert.rejects(readAsync(), (error: unknown) => {
        assert.ok(error instanceof GitFailedException);
        assert.deepEqual([error.code, error.command, error.message, error.output?.source], [failed.code, failed.command, failed.message, UntrustedSource.Repository]);
        assert.match(error.output?.text ?? "", /bad config line/v);
        return true;
      });
  });
});
