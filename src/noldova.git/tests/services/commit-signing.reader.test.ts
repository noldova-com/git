/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { GitCommitSigning, SigningFormat, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { CommitSigningReader } from "../../src/services/commit-signing.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("CommitSigningReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let reader: CommitSigningReader;
  let scripted: ScriptedRunnerFixture;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    const supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    reader = new CommitSigningReader(new ProgramRunner(supervisor.context));
    scripted = new ScriptedRunnerFixture(supervisor.context);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const untrusted = (error: unknown): boolean => error instanceof GitFailedException && error.output?.source === UntrustedSource.Repository;

  test("answers unsigned with git's default OpenPGP format when neither setting is set", async () => {
    assert.deepEqual(await reader.readAsync(repository.folder), new GitCommitSigning(false, SigningFormat.OpenPgp));
  });

  test("answers signed with SSH when the repository turns signing on and sets the SSH format", async () => {
    await repository.runGitAsync(["config", "--local", "commit.gpgsign", "true"]);
    await repository.runGitAsync(["config", "--local", "gpg.format", "ssh"]);

    assert.deepEqual(await reader.readAsync(repository.folder), new GitCommitSigning(true, SigningFormat.Ssh));
  });

  test("takes the person's own settings, any spelling git reads as a boolean, and the repository's last word over them", async () => {
    await repository.runGitAsync(["config", "--global", "commit.gpgsign", "yes"]);
    await repository.runGitAsync(["config", "--global", "gpg.format", "x509"]);
    const global = await reader.readAsync(repository.folder);
    await repository.runGitAsync(["config", "--local", "commit.gpgsign", "off"]);
    const local = await reader.readAsync(repository.folder);

    assert.deepEqual([global, local], [new GitCommitSigning(true, SigningFormat.X509), new GitCommitSigning(false, SigningFormat.X509)]);
  });

  test("answers no format for a gpg.format git doesn't know, since git refuses to sign with it", async () => {
    await repository.runGitAsync(["config", "--local", "commit.gpgsign", "true"]);
    await repository.runGitAsync(["config", "--local", "gpg.format", "SSH"]);

    assert.deepEqual(await reader.readAsync(repository.folder), new GitCommitSigning(true, null));
  });

  test("fails with git's errors marked untrusted when commit.gpgsign isn't a boolean", async () => {
    await repository.runGitAsync(["config", "--local", "commit.gpgsign", "sometimes"]);

    await assert.rejects(reader.readAsync(repository.folder), untrusted);
  });

  test("fails with git's errors marked untrusted when either read fails or its output is cut", async () => {
    for (const failing of ["commit.gpgsign", "gpg.format"]) {
      scripted.failing = failing;
      scripted.failingCode = 128;
      await assert.rejects(new CommitSigningReader(scripted).readAsync(repository.folder), untrusted);
    }
    scripted.failing = null;
    await repository.runGitAsync(["config", "--local", "gpg.format", "ssh"]);
    for (const truncating of ["commit.gpgsign", "gpg.format"]) {
      scripted.truncating = truncating;
      await repository.runGitAsync(["config", "--local", "commit.gpgsign", "true"]);
      await assert.rejects(new CommitSigningReader(scripted).readAsync(repository.folder), untrusted);
    }
  });
});
