/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, unlink } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test, vi } from "vitest";

import { ProcessExit } from "@noldova/desktop.runtime";
import { FileState, StatusEntry } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { ProgramResult } from "../../src/models/program-result.ts";
import type { ProgramRun } from "../../src/models/program-run.ts";
import { LfsPointerReader } from "../../src/services/lfs-pointer.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

vi.mock(import("node:fs/promises"), { spy: true });

/** Runs git, and hands back a command's output changed when its arguments end as one of the rewrites says. */
class RewritingRunner extends ProgramRunner {
  public readonly rewrites: Map<string, (output: Buffer) => ProgramResult> = new Map();

  public override async runAsync(run: ProgramRun): Promise<ProgramResult> {
    const result = await super.runAsync(run);
    const command = run.arguments.join(" ");
    const rewrite = [...this.rewrites].find(([ending]) => command.endsWith(ending))?.[1];
    return rewrite === undefined ? result : rewrite(result.output);
  }
}

describe("LfsPointerReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: RewritingRunner;
  let reader: LfsPointerReader;

  const pointerOf = (content: string): string =>
    `version https://git-lfs.github.com/spec/v1\noid sha256:${createHash("sha256").update(content).digest("hex")}\nsize ${Buffer.byteLength(content)}\n`;
  const entry = (file: string, index: FileState = FileState.Unmodified): StatusEntry =>
    new StatusEntry(file, undefined, null, undefined, index, FileState.Modified, null, null, null, null);
  const answer = (output: string | Buffer, code: number = 0, truncated: boolean = false): ProgramResult =>
    new ProgramResult(new ProcessExit(code, null), Buffer.from(output), Buffer.from("refused\n"), truncated);

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.writeAsync(".gitattributes", "*.bin filter=lfs diff=lfs merge=lfs -text\n");
    await template.writeAsync("a.bin", pointerOf("alpha"));
    await template.runGitAsync(["add", ".gitattributes", "a.bin"]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Track LFS"]);
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new RewritingRunner(supervisor.context);
    reader = new LfsPointerReader(runner);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  test("keeps a staged LFS file whose content matches its new pointer, as unmodified in the worktree only", async () => {
    await repository.writeAsync("a.bin", pointerOf("beta"));
    await repository.runGitAsync(["add", "a.bin"]);
    await repository.writeAsync("a.bin", "beta");

    const check = await reader.cleanAsync(repository.folder, [entry("a.bin", FileState.Modified)]);

    assert.deepEqual(check.entries.map(t => [t.path, t.index, t.worktree]), [["a.bin", FileState.Modified, FileState.Unmodified]]);
    assert.equal(check.unchecked, 0);
  });

  test("leaves a file as git reads it when it is gone, is a folder, or has no stage-0 entry", async () => {
    await unlink(path.join(repository.folder, "a.bin"));
    assert.deepEqual((await reader.cleanAsync(repository.folder, [entry("a.bin")])).entries.map(t => t.worktree), [FileState.Modified]);
    await mkdir(path.join(repository.folder, "a.bin"));
    assert.deepEqual((await reader.cleanAsync(repository.folder, [entry("a.bin")])).entries.map(t => t.worktree), [FileState.Modified]);
    runner.rewrites.set("-z", () => answer("missing"));

    const check = await reader.cleanAsync(repository.folder, [entry("a.bin"), entry("b.bin")]);

    assert.deepEqual([check.entries.map(t => t.worktree), check.unchecked], [[FileState.Modified, FileState.Modified], 0]);
  });

  test("reads attributes git ends without a NUL, and stops at a blob header it can't read, counting that file unchecked", async () => {
    await repository.writeAsync("a.bin", "alpha");
    runner.rewrites.set("filter", output => answer(output.subarray(0, output.length - 1)));
    runner.rewrites.set("--batch", output => answer(output.subarray(0, 10)));

    const cut = await reader.cleanAsync(repository.folder, [entry("a.bin")]);
    runner.rewrites.set("--batch", () => answer("not a header\nbody\n"));
    const unreadable = await new LfsPointerReader(runner).cleanAsync(repository.folder, [entry("a.bin")]);

    assert.deepEqual([cut.unchecked, unreadable.unchecked], [1, 1]);
  });

  test("passes on a failure reading a file that isn't the file system's", async () => {
    await repository.writeAsync("a.bin", "alpha");
    const broken = new Error("broken");
    vi.mocked(lstat).mockRejectedValueOnce(broken);

    await assert.rejects(reader.cleanAsync(repository.folder, [entry("a.bin")]), broken);
  });

  test("fails with git's errors when a read fails or is cut", async () => {
    await repository.writeAsync("a.bin", "alpha");
    runner.rewrites.set("filter", () => answer("", 128));
    await assert.rejects(reader.cleanAsync(repository.folder, [entry("a.bin")]), GitFailedException);
    runner.rewrites.set("filter", output => answer(output, 0, true));
    await assert.rejects(reader.cleanAsync(repository.folder, [entry("a.bin")]), GitFailedException);
  });
});
