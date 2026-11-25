/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { access, mkdir, readFile, symlink } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { ConflictResolution } from "@noldova/git.protocol";

import { ConflictGoneException } from "../../src/exceptions/conflict-gone.exception.ts";
import { FileOutsideRepositoryException } from "../../src/exceptions/file-outside-repository.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { ResolutionMarkersLeftException } from "../../src/exceptions/resolution-markers-left.exception.ts";
import { ResolutionNotOfferedException } from "../../src/exceptions/resolution-not-offered.exception.ts";
import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { ResolveConflictWriter } from "../../src/services/resolve-conflict.writer.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryState } from "../fixtures/repository-state.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("ResolveConflictWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let repositories: RepositoryReader;
  let statuses: StatusReader;
  let hooks: HooksReader;
  let filters: FilterOptionsReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.writeAsync("a.txt", "one\ntwo\nthree\n");
    await template.writeAsync("b.txt", "b\n");
    await template.runGitAsync(["add", "."]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Base"]);
    await template.runGitAsync(["switch", "--quiet", "--create", "side"]);
    await template.writeAsync("a.txt", "one\nside\nthree\n");
    await template.runGitAsync(["rm", "--quiet", "b.txt"]);
    await template.writeAsync("c.txt", "side c\n");
    await template.runGitAsync(["add", "."]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Change on side"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
    await template.writeAsync("a.txt", "one\nmain\nthree\n");
    await template.writeAsync("b.txt", "b main\n");
    await template.writeAsync("c.txt", "main c\n");
    await template.runGitAsync(["add", "."]);
    await template.runGitAsync(["commit", "--quiet", "-m", "Change on main"]);
    await template.runGitAsync(["merge", "--quiet", "side"]).catch(() => "");
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new ProgramRunner(supervisor.context);
    repositories = new RepositoryReader(runner, new GitVersionReader(runner));
    statuses = new StatusReader(runner);
    hooks = new HooksReader(runner);
    filters = new FilterOptionsReader(runner);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const readAsync = async (): Promise<RepositoryState> => {
    const folders = await repositories.readAsync(repository.folder);
    return new RepositoryState(folders, await statuses.readAsync(folders));
  };
  const writer = (file: string, resolution: ConflictResolution, text: string | null = null, programs: ProgramRunner = runner): ResolveConflictWriter =>
    new ResolveConflictWriter(programs, hooks, filters, file, resolution, text);
  const resolveAsync = async (write: ResolveConflictWriter): Promise<void> => {
    const { folders, status } = await readAsync();
    write.refuse(status);
    await write.runAsync(folders, status);
  };
  const unmergedAsync = (file: string): Promise<string> => repository.runGitAsync(["ls-files", "--unmerged", "--", file]);
  const worktreeAsync = (file: string): Promise<string> => readFile(path.join(repository.folder, file), "utf8");
  const call = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };

  test("writes the resolved text and stages it, an absent text as an empty file", async () => {
    await resolveAsync(writer("a.txt", ConflictResolution.Text, "one\nresolved\nthree\n"));
    await resolveAsync(writer("c.txt", ConflictResolution.Text));

    assert.deepEqual([await worktreeAsync("a.txt"), await repository.runGitAsync(["show", ":a.txt"]), await unmergedAsync("a.txt")],
      ["one\nresolved\nthree\n", "one\nresolved\nthree\n", ""]);
    assert.deepEqual([await worktreeAsync("c.txt"), await unmergedAsync("c.txt")], ["", ""]);
  });

  test("takes our or their whole file and stages it", async () => {
    await resolveAsync(writer("a.txt", ConflictResolution.Theirs));
    await resolveAsync(writer("c.txt", ConflictResolution.Ours));
    await resolveAsync(writer("b.txt", ConflictResolution.Ours));

    assert.deepEqual([await worktreeAsync("a.txt"), await worktreeAsync("c.txt"), await worktreeAsync("b.txt")], ["one\nside\nthree\n", "main c\n", "b main\n"]);
    assert.equal(await repository.runGitAsync(["ls-files", "--unmerged"]), "");
  });

  test("deletes a file one side deleted and stages the removal", async () => {
    await resolveAsync(writer("b.txt", ConflictResolution.Delete));

    assert.deepEqual([await access(path.join(repository.folder, "b.txt")).then(() => true, () => false), await repository.runGitAsync(["ls-files", "b.txt"])],
      [false, ""]);
  });

  test("refuses a file no longer unmerged, a choice its kind doesn't offer, and a text with a marker line left, changing nothing", async () => {
    await resolveAsync(writer("a.txt", ConflictResolution.Ours));
    const { status } = await readAsync();

    assert.throws(() => writer("a.txt", ConflictResolution.Theirs).refuse(status), (error: unknown) => error instanceof ConflictGoneException);
    assert.throws(() => writer("nothing.txt", ConflictResolution.Ours).refuse(status), (error: unknown) => error instanceof ConflictGoneException);
    for (const [file, resolution] of [["b.txt", ConflictResolution.Theirs], ["b.txt", ConflictResolution.Text], ["c.txt", ConflictResolution.Delete]] as const)
      assert.throws(() => writer(file, resolution, "text\n").refuse(status), (error: unknown) => error instanceof ResolutionNotOfferedException, `${file} ${resolution}`);
    assert.throws(() => writer("c.txt", ConflictResolution.Text, "a\n=======\nb\n").refuse(status), (error: unknown) => error instanceof ResolutionMarkersLeftException);
    assert.doesNotThrow(() => writer("c.txt", ConflictResolution.Text, "both\n").refuse(status));
    assert.equal(await worktreeAsync("c.txt"), "<<<<<<< HEAD\nmain c\n=======\nside c\n>>>>>>> side\n");
  });

  test("refuses to write through a folder link that leads outside the repository", async () => {
    const outside = path.join(repository.root, "outside");
    await mkdir(outside);
    await symlink(outside, path.join(repository.folder, "linked"), "junction");
    const { folders, status } = await readAsync();

    await assert.rejects(writer(path.join("linked", "x.txt"), ConflictResolution.Text, "x\n").runAsync(folders, status),
      (error: unknown) => error instanceof FileOutsideRepositoryException);
    assert.equal(await access(path.join(outside, "x.txt")).then(() => true, () => false), false);
  });

  test("fails with git's errors as untrusted text when the checkout, the removal or the staging fails", async () => {
    const scripted = new ScriptedRunnerFixture(supervisor.context);

    for (const [failing, file, resolution] of [["checkout", "a.txt", ConflictResolution.Ours], ["rm", "b.txt", ConflictResolution.Delete],
      ["add", "a.txt", ConflictResolution.Text]] as const) {
      scripted.failing = failing;
      await assert.rejects(resolveAsync(writer(file, resolution, resolution === ConflictResolution.Text ? "text\n" : null, scripted)), (error: unknown) =>
        error instanceof GitFailedException && error.output?.text === "scripted failure\n", failing);
    }
  });

  test("asks an agent's resolution at medium risk, once only, saying when a side's whole file replaces the other's changes", async () => {
    const { folders, status } = await readAsync();

    assert.deepEqual(await writer("a.txt", ConflictResolution.Ours).requestAsync(folders, status, call), {
      action: "git.resolveConflict",
      subject: folders.top,
      title: "Resolve a.txt with our whole file",
      details: [
        { label: "Files", kind: PermissionDetailKind.Code, value: "a.txt" },
        { label: "Whole file", kind: PermissionDetailKind.Text, value: "This takes the whole file from one side and drops every change from the other, not only the conflicting lines." },
        { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "None" }
      ],
      risk: ToolRisk.Medium,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    });
    await repository.runGitAsync(["config", "filter.crypt.clean", "crypt-filter"]);
    const asked = await writer("c.txt", ConflictResolution.Text, "both\n").requestAsync(folders, status, call);
    assert.deepEqual([asked?.title, asked?.details], ["Resolve c.txt with the resolved text", [
      { label: "Files", kind: PermissionDetailKind.Code, value: "c.txt" },
      { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "None" },
      { label: "Filters that will run", kind: PermissionDetailKind.Text, value: "crypt" }
    ]]);
    assert.equal((await writer("b.txt", ConflictResolution.Delete).requestAsync(folders, status, call))?.title, "Resolve b.txt with deleting it");
    assert.equal((await writer("a.txt", ConflictResolution.Theirs).requestAsync(folders, status, call))?.details.length, 4);
    assert.equal((await writer("nothing.txt", ConflictResolution.Theirs).requestAsync(folders, status, call))?.title, "Resolve nothing.txt with their whole file");
  });
});
