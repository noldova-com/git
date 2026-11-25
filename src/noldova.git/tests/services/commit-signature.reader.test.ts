/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { GitCommitSignature, SignatureState, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { CommitSignatureReader } from "../../src/services/commit-signature.reader.ts";
import { FilePresence } from "../../src/services/file-presence.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

/** A signed commit, and the allowed signers line that trusts its key. */
interface ISignedCommit {
  readonly id: string;
  readonly signers: string;
}

/** A program that leaves a marker file when git runs it. */
interface IMarkerScript {
  readonly script: string;
  readonly marker: string;
}

describe("CommitSignatureReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let reader: CommitSignatureReader;
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
    reader = new CommitSignatureReader(new ProgramRunner(supervisor.context));
    scripted = new ScriptedRunnerFixture(supervisor.context);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const headAsync = async (): Promise<string> => (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();

  /** Signs a commit with a new SSH key, and returns the commit and the allowed signers line that trusts the key. */
  const signAsync = async (): Promise<ISignedCommit> => {
    const key = path.join(repository.root, "signing-key");
    await promisify(execFile)("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "", "-f", key]);
    await repository.runGitAsync(["-c", "gpg.format=ssh", "-c", `user.signingKey=${key.replaceAll("\\", "/")}`, "commit", "--quiet", "--allow-empty", "-S", "-m",
      "Signed"]);
    return { id: await headAsync(), signers: `test@example.invalid ${(await readFile(`${key}.pub`, "utf8")).trim()}\n` };
  };

  /** A script that leaves a marker file when git runs it as a signing program, and fails as a missing gpg would. */
  const markerScriptAsync = async (name: string): Promise<IMarkerScript> => {
    const script = path.join(repository.programs, name);
    const marker = path.join(repository.root, `${name}.ran`);
    await writeFile(script, `#!/bin/sh\necho ran > "${marker.replaceAll("\\", "/")}"\nexit 1\n`);
    await chmod(script, 0o755);
    return { script: script.replaceAll("\\", "/"), marker };
  };

  /** A commit carrying an OpenPGP signature block, which makes git run the OpenPGP program to check it. */
  const pgpSignedAsync = async (): Promise<string> => {
    const head = await headAsync();
    const tree = (await repository.runGitAsync(["rev-parse", "HEAD^{tree}"])).trim();
    const commit = [`tree ${tree}`, `parent ${head}`, "author A <a@example.invalid> 1700000000 +0000", "committer A <a@example.invalid> 1700000000 +0000",
      "gpgsig -----BEGIN PGP SIGNATURE-----", " ", " iQ==", " -----END PGP SIGNATURE-----", "", "Signed", ""].join("\n");
    return (await repository.runGitAsync(["hash-object", "-t", "commit", "-w", "--stdin"], commit)).trim();
  };

  test("answers None with no signer or key for an unsigned commit", async () => {
    const id = await headAsync();

    assert.deepEqual(await reader.readAsync(repository.folder, id), new GitCommitSignature(id, SignatureState.None, null, null));
  });

  test("verifies a signature against the person's own allowed signers, naming the signer and key, and never against the repository's", async () => {
    const { id, signers } = await signAsync();
    const allowed = path.join(repository.root, "allowed-signers");
    await writeFile(allowed, signers);

    await repository.runGitAsync(["config", "--local", "gpg.ssh.allowedSignersFile", allowed.replaceAll("\\", "/")]);
    const local = await reader.readAsync(repository.folder, id);
    await repository.runGitAsync(["config", "--global", "gpg.ssh.allowedSignersFile", allowed.replaceAll("\\", "/")]);
    const global = await reader.readAsync(repository.folder, id);

    assert.equal(local.state, SignatureState.Unverified);
    assert.deepEqual([global.state, global.signer], [SignatureState.Verified, "test@example.invalid"]);
    assert.match(global.key ?? "", /^SHA256:/u);
  });

  test("runs the person's own OpenPGP program to check a signature, never the one the repository's configuration names", async () => {
    const id = await pgpSignedAsync();
    const local = await markerScriptAsync("local-gpg");
    const global = await markerScriptAsync("global-gpg");
    await repository.runGitAsync(["config", "--local", "gpg.program", local.script]);
    await repository.runGitAsync(["log", "-1", "--format=%G?", id]);
    const ranUnpinned = await FilePresence.existsAsync(local.marker);
    await writeFile(local.marker, "");
    await repository.runGitAsync(["config", "--global", "gpg.program", global.script]);

    const signature = await reader.readAsync(repository.folder, id);

    assert.equal(ranUnpinned, true);
    assert.deepEqual([signature.state, await readFile(local.marker, "utf8"), await FilePresence.existsAsync(global.marker)], [SignatureState.Unverified, "", true]);
  });

  test("pins each signing setting to the person's last global or system value, an OpenPGP program under both its names, else git's default, ignoring every other scope",
    async () => {
      const id = await headAsync();
      const commands: string[] = [];
      scripted.starting = command => commands.push(command);
      scripted.answering = ["--show-scope", [
        "system\tgpg.ssh.program /system/ssh-keygen", "global\tgpg.ssh.program /home/ssh-keygen", "global\tgpg.openpgp.program /home/gpg",
        "global\tgpg.program /home/program", "global\tgpg.format ssh", "system\tgpg.mintrustlevel fully", "local\tgpg.program /repository/gpg", "worktree\tgpg.ssh.allowedsignersfile /repository/signers",
        "command\tgpg.x509.program /command/gpgsm", "unknown\tgpg.ssh.defaultkeycommand /unknown/key", "\tgpg.mintrustlevel never", ""
      ].join("\n")];

      await new CommitSignatureReader(scripted).readAsync(repository.folder, id);

      const log = commands.find(t => t.includes("%G?")) ?? "";
      assert.deepEqual(log.split(" ").filter(t => t.startsWith("gpg.")), [
        "gpg.program=/home/gpg", "gpg.openpgp.program=/home/gpg", "gpg.mintrustlevel=fully", "gpg.ssh.program=/home/ssh-keygen", "gpg.x509.program=gpgsm",
        "gpg.ssh.allowedsignersfile=/dev/null", "gpg.ssh.defaultkeycommand="
      ]);
    });

  test("reads the signature headers of a commit object that ends without a message", async () => {
    const id = await headAsync();
    scripted.answering = ["cat-file", `tree ${"0".repeat(id.length)}\ngpgsig -----BEGIN PGP SIGNATURE-----\n`];

    assert.deepEqual(await new CommitSignatureReader(scripted).readAsync(repository.folder, id), new GitCommitSignature(id, SignatureState.Unverified, null, null));
  });

  test("fails with git's errors marked untrusted when it can't read the configuration, check the commit, or read a commit git reports unsigned", async () => {
    const id = await headAsync();
    const untrusted = (error: unknown): boolean => error instanceof GitFailedException && error.output?.source === UntrustedSource.Repository;

    for (const failing of ["--show-scope", "%G?", "cat-file"]) {
      scripted.failing = failing;
      scripted.failingCode = 128;
      await assert.rejects(new CommitSignatureReader(scripted).readAsync(repository.folder, id), untrusted);
    }
    await assert.rejects(reader.readAsync(repository.folder, "f".repeat(id.length)), untrusted);
  });
});
