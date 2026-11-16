/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { OperationKind } from "@noldova/git.protocol";

import { OperationReader } from "../../src/services/operation.reader.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("OperationReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  let other: string;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["switch", "--quiet", "--create", "other"]);
    await template.writeAsync("a.txt", "other\n");
    await template.runGitAsync(["commit", "--quiet", "--all", "--message=Other change"]);
    await template.runGitAsync(["switch", "--quiet", "main"]);
    await template.writeAsync("a.txt", "main\n");
    await template.runGitAsync(["commit", "--quiet", "--all", "--message=Main change"]);
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    other = (await repository.runGitAsync(["rev-parse", "other"])).trim();
  });

  afterEach(async () => {
    await repository.disposeAsync();
  });

  const read = async (): Promise<unknown> => (await OperationReader.readAsync(repository.gitFolder))?.toJson() ?? null;
  const conflictAsync = (gitArguments: readonly string[]): Promise<void> => assert.rejects(repository.runGitAsync(gitArguments), { code: 1 });

  test("finds no operation in a repository without one", async () => {
    assert.equal(await read(), null);
  });

  test("reads the merge, cherry-pick and revert that git stops in on a conflict, with the commit they apply and the first line of their message", async () => {
    await conflictAsync(["merge", "other"]);
    const merge = await read();
    await repository.runGitAsync(["merge", "--abort"]);
    await conflictAsync(["cherry-pick", "other"]);
    const pick = await read();
    await repository.runGitAsync(["cherry-pick", "--abort"]);
    await conflictAsync(["revert", "--no-edit", "other"]);
    const revert = await read();
    await repository.runGitAsync(["revert", "--abort"]);

    assert.deepEqual([merge, pick, revert, await read()], [
      { kind: OperationKind.Merge, from: other, message: "Merge branch 'other'" },
      { kind: OperationKind.CherryPick, from: other, message: "Other change" },
      { kind: OperationKind.Revert, from: other, message: `Revert "Other change"` },
      null
    ]);
  });

  test("reads no message for a cherry-pick of a commit with an empty one", async () => {
    await repository.runGitAsync(["switch", "--quiet", "--detach", "main~1"]);
    await repository.writeAsync("a.txt", "empty message\n");
    await repository.runGitAsync(["commit", "--quiet", "--all", "--allow-empty-message", "--message="]);
    const empty = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
    await repository.runGitAsync(["switch", "--quiet", "main"]);

    await conflictAsync(["cherry-pick", empty]);

    assert.deepEqual(await read(), { kind: OperationKind.CherryPick, from: empty, message: null });
  });

  test("reads a rebase that git stops in, with the branch it rebases or none when HEAD is detached, by either backend", async () => {
    await repository.runGitAsync(["switch", "--quiet", "other"]);
    await conflictAsync(["rebase", "main"]);
    const merging = await read();
    await repository.runGitAsync(["rebase", "--abort"]);
    await conflictAsync(["rebase", "--apply", "main"]);
    const applying = await read();
    await repository.runGitAsync(["rebase", "--abort"]);
    await repository.runGitAsync(["switch", "--quiet", "--detach", "other"]);
    await conflictAsync(["rebase", "main"]);
    const detached = await read();
    await repository.runGitAsync(["rebase", "--abort"]);

    assert.deepEqual([merging, applying, detached], [
      { kind: OperationKind.Rebase, from: "other", message: null },
      { kind: OperationKind.Rebase, from: "other", message: null },
      { kind: OperationKind.Rebase, from: null, message: null }
    ]);
  });

  test("reads a rebase ahead of a cherry-pick that stopped inside it", async () => {
    await repository.runGitAsync(["switch", "--quiet", "--create", "feature", "main"]);
    await repository.writeAsync("b.txt", "b\n");
    await repository.runGitAsync(["add", "b.txt"]);
    await repository.runGitAsync(["commit", "--quiet", "--message=Add b"]);

    await conflictAsync(["rebase", "--exec", `git cherry-pick ${other}`, "main~1"]);

    assert.deepEqual(await read(), { kind: OperationKind.Rebase, from: "feature", message: null });
  });

  test("reads no operation for a mailbox apply that git stops in", async () => {
    const patch = await repository.runGitAsync(["format-patch", "-1", "--stdout", "other"]);

    await assert.rejects(repository.runGitAsync(["am"], patch));

    assert.equal(await read(), null);
  });

  test("reads a rebase whose head-name names no branch as from none, by a written file, since git never writes one", async () => {
    await mkdir(path.join(repository.gitFolder, "rebase-merge"));
    await writeFile(path.join(repository.gitFolder, "rebase-merge", "head-name"), "refs/heads/\n");

    assert.deepEqual(await read(), { kind: OperationKind.Rebase, from: null, message: null });
  });

  test("fails when git's file can't be read for another reason than being gone, by a folder in its place, since git never makes one", async () => {
    await mkdir(path.join(repository.gitFolder, "MERGE_HEAD"));

    await assert.rejects(OperationReader.readAsync(repository.gitFolder), (error: unknown) => error instanceof Error && "code" in error && error.code === "EISDIR");
  });
});
