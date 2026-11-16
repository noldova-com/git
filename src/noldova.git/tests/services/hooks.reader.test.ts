/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { appendFile, chmod, mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { FailureCode } from "@noldova/git.protocol";

import { HooksUnreadableException } from "../../src/exceptions/hooks-unreadable.exception.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("HooksReader", () => {
  const names = ["pre-commit", "prepare-commit-msg", "commit-msg", "post-commit"];
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  let supervisor: DesktopFixture;
  let runner: ScriptedRunnerFixture;
  let hooks: HooksReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    runner = new ScriptedRunnerFixture(supervisor.context);
    hooks = new HooksReader(runner);
  });

  afterEach(async () => {
    await supervisor.disposeAsync();
    await repository.disposeAsync();
  });

  const hookAsync = async (folder: string, name: string, content: string, mode: number): Promise<void> => {
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, name), content);
    await chmod(path.join(folder, name), mode);
  };
  const breakConfigurationAsync = (): Promise<void> => appendFile(path.join(repository.gitFolder, "config"), "[broken\n");

  test("names none when the hooks folder holds only git's samples", async () => {
    assert.deepEqual(await hooks.readAsync(repository.folder, names), []);
  });

  test("names the runnable hooks in the order asked, from the repository's hooks folder", async () => {
    const folder = path.join(repository.gitFolder, "hooks");
    await hookAsync(folder, "commit-msg", "#!/bin/sh\nexit 0\n", 0o755);
    await hookAsync(folder, "pre-commit", "#!/bin/sh\nexit 0\n", 0o755);
    await mkdir(path.join(folder, "post-commit"));

    assert.deepEqual(await hooks.readAsync(repository.folder, names), ["pre-commit", "commit-msg"]);
  });

  test("tells a hook git skips as not executable on Linux and macOS", async context => {
    context.skip(process.platform === "win32", "Windows has no executable bit; Git for Windows reads a hook's first bytes instead.");
    const folder = path.join(repository.gitFolder, "hooks");
    await hookAsync(folder, "pre-commit", "#!/bin/sh\nexit 0\n", 0o644);
    await hookAsync(folder, "commit-msg", "MZ", 0o644);

    assert.deepEqual(await hooks.readAsync(repository.folder, names), []);
  });

  test("tells on Windows a script or a program from any other file, as Git for Windows does", async context => {
    context.skip(process.platform !== "win32", "Only Git for Windows runs a hook by its first bytes; elsewhere git reads the executable bit.");
    const folder = path.join(repository.gitFolder, "hooks");
    await hookAsync(folder, "pre-commit", "#!/bin/sh\nexit 0\n", 0o644);
    await hookAsync(folder, "commit-msg", "MZ", 0o644);
    await hookAsync(folder, "post-commit", "exit 0\n", 0o644);

    assert.deepEqual(await hooks.readAsync(repository.folder, names), ["pre-commit", "commit-msg"]);
  });

  test("names an executable hook whatever it starts with on Linux and macOS", async context => {
    context.skip(process.platform === "win32", "Windows has no executable bit; Git for Windows reads a hook's first bytes instead.");
    const folder = path.join(repository.gitFolder, "hooks");
    await hookAsync(folder, "pre-commit", "exit 0\n", 0o755);

    assert.deepEqual(await hooks.readAsync(repository.folder, names), ["pre-commit"]);
  });

  test("reads the folder core.hooksPath names, relative to the worktree", async () => {
    await repository.runGitAsync(["config", "core.hooksPath", "tools/hooks"]);
    await hookAsync(path.join(repository.folder, "tools", "hooks"), "pre-commit", "#!/bin/sh\nexit 0\n", 0o755);
    await hookAsync(path.join(repository.gitFolder, "hooks"), "commit-msg", "#!/bin/sh\nexit 0\n", 0o755);

    assert.deepEqual(await hooks.readAsync(repository.folder, names), ["pre-commit"]);
  });

  test("answers the hooks as unknown, never as none, when git can't name the hooks folder", async () => {
    await hookAsync(path.join(repository.gitFolder, "hooks"), "pre-commit", "#!/bin/sh\nexit 0\n", 0o755);
    await breakConfigurationAsync();

    assert.equal(await hooks.readAsync(repository.folder, names), null);
  });

  test("answers the hooks as unknown when a hook's file can't be read", async () => {
    const hook = path.join(repository.gitFolder, "hooks", "commit-msg");
    await symlink(hook, hook, "junction");

    assert.equal(await hooks.readAsync(repository.folder, names), null);
  });

  test("answers the hooks as none when the folder core.hooksPath names isn't there", async () => {
    await repository.runGitAsync(["config", "core.hooksPath", "missing/hooks"]);

    assert.deepEqual(await hooks.readAsync(repository.folder, names), []);
  });

  test("fails with an error that isn't the file system's, rather than answering the hooks as unknown", async () => {
    runner.answering = ["--git-path hooks", `${path.join(repository.gitFolder, "hooks")}\u0000\n`];

    await assert.rejects(hooks.readAsync(repository.folder, names), { name: "TypeError", code: "ERR_INVALID_ARG_VALUE" });
  });

  test("fails a read that must know the hooks when they can't be read, and answers them when they can", async () => {
    await hookAsync(path.join(repository.gitFolder, "hooks"), "pre-commit", "#!/bin/sh\nexit 0\n", 0o755);
    assert.deepEqual(await hooks.readKnownAsync(repository.folder, names), ["pre-commit"]);

    await breakConfigurationAsync();
    await assert.rejects(hooks.readKnownAsync(repository.folder, names), (error: unknown) => error instanceof HooksUnreadableException
      && error.code === FailureCode.Unavailable && error.gitCode === null && error.message === "The repository's hooks couldn't be read.");
  });
});
