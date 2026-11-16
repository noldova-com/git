/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { FailureCode, UntrustedSource } from "@noldova/git.protocol";

import { FilterNotSwitchableException } from "../../src/exceptions/filter-not-switchable.exception.ts";
import { FilterSubmodulesTooManyException } from "../../src/exceptions/filter-submodules-too-many.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { Resources } from "../../src/resources.ts";
import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("FilterOptionsReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  let supervisor: DesktopFixture;
  let runner: ScriptedRunnerFixture;
  let reader: FilterOptionsReader;

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
    reader = new FilterOptionsReader(runner);
  });

  afterEach(async () => {
    await supervisor.disposeAsync();
    await repository.disposeAsync();
  });

  const switchedOff = (name: string): string[] => ["-c", `filter.${name}.clean=`, "-c", `filter.${name}.process=`, "-c", `filter.${name}.required=false`];
  const unavailable = (type: abstract new (...args: never[]) => GitFailureException, message: string): ((error: unknown) => boolean) => (error: unknown): boolean => {
    assert.ok(error instanceof type);
    assert.deepEqual([error.code, error.gitCode, error.message], [FailureCode.Unavailable, null, message]);
    return true;
  };

  test("answers no options when no configuration names a filter", async () => {
    assert.deepEqual(await reader.readAsync(repository.folder), []);
  });

  test("switches off each driver the repository's configuration or a file it includes gives a command, once, and not the person's own", async () => {
    const included = path.join(repository.root, "included.gitconfig");
    await writeFile(included, "[filter \"inc\"]\n\tprocess = inc-filter\n");
    await mkdir(path.join(repository.configuration, "git"), { recursive: true });
    await repository.runGitAsync(["config", "--file", path.join(repository.configuration, "git", "config"), "filter.own.clean", "own-filter"]);
    await repository.runGitAsync(["config", "filter.evil.clean", "evil-filter"]);
    await repository.runGitAsync(["config", "filter.evil.process", "evil-process"]);
    await repository.runGitAsync(["config", "filter.dotted.name.clean", "dotted-filter"]);
    await repository.runGitAsync(["config", "filter.smudged.smudge", "smudge-only"]);
    await repository.runGitAsync(["config", "include.path", included.split(path.sep).join("/")]);

    assert.deepEqual(await reader.readAsync(repository.folder), [...switchedOff("evil"), ...switchedOff("dotted.name"), ...switchedOff("inc")]);
  });

  test("names the drivers the repository's configuration gives a command of the asked kinds, once and in order, one an option can't name too", async () => {
    await mkdir(path.join(repository.configuration, "git"), { recursive: true });
    await repository.runGitAsync(["config", "--file", path.join(repository.configuration, "git", "config"), "filter.own.process", "own-filter"]);
    await repository.runGitAsync(["config", "filter.a=b.clean", "evil-filter"]);
    await repository.runGitAsync(["config", "filter.lfs.smudge", "lfs-smudge"]);
    await repository.runGitAsync(["config", "filter.lfs.process", "lfs-process"]);
    await repository.runGitAsync(["config", "filter.crypt.clean", "crypt-clean"]);

    assert.deepEqual([
      await reader.namesAsync(repository.folder, Resources.stageFilterKinds),
      await reader.namesAsync(repository.folder, Resources.checkoutFilterKinds)
    ], [["a=b", "lfs", "crypt"], ["lfs"]]);
  });

  test("refuses to read a repository whose configuration names a driver that an option can't name", async () => {
    await repository.runGitAsync(["config", "filter.a=b.clean", "evil-filter"]);

    await assert.rejects(reader.readAsync(repository.folder),
      unavailable(FilterNotSwitchableException, "The repository's configuration names a filter whose name the module can't switch off, so it doesn't read the folder."));
  });

  test("fails with git's output when git can't read the configuration, or its answer is cut short", async () => {
    await repository.runGitAsync(["config", "filter.evil.clean", "evil-filter"]);
    const outside = path.join(repository.root, "outside");
    await mkdir(outside);
    const configuration = path.join(repository.configuration, "git", "config");
    await mkdir(path.dirname(configuration), { recursive: true });
    await writeFile(configuration, "[broken\n");

    await assert.rejects(reader.readAsync(outside), (error: unknown): boolean => {
      assert.ok(unavailable(GitFailedException, "git config failed; its output comes with the failure as untrusted text.")(error) && error instanceof GitFailedException);
      assert.equal(error.output?.source, UntrustedSource.Repository);
      assert.match(error.output?.text ?? "", /bad config line/v);
      return true;
    });
    await rm(configuration);
    runner.truncating = "--show-scope";
    await assert.rejects(reader.readAsync(repository.folder), unavailable(GitFailedException, "git config failed; its output comes with the failure as untrusted text."));
  });

  test("fails with the file system's error when it can't look for a checkout for a reason other than its absence", async () => {
    await assert.rejects(reader.readAsync(`${repository.folder}${String.fromCharCode(0)}`), { name: "TypeError", code: "ERR_INVALID_ARG_VALUE" });
    assert.deepEqual(supervisor.requests, []);
  });

  test("switches off the drivers each checked-out submodule's own configuration names, at any depth", async () => {
    const sources = { library: path.join(repository.root, "library"), inner: path.join(repository.root, "inner") };
    for (const [name, source] of Object.entries(sources)) {
      await repository.runGitAsync(["init", "--quiet", source]);
      await writeFile(path.join(source, `${name}.txt`), "a\n");
      await repository.runGitAsync(["-C", source, "add", `${name}.txt`]);
      await repository.runGitAsync(["-C", source, "commit", "--quiet", "-m", name]);
    }
    await repository.runGitAsync(["-C", sources.library, "-c", "protocol.file.allow=always", "submodule", "--quiet", "add", sources.inner, "inner"]);
    await repository.runGitAsync(["-C", sources.library, "commit", "--quiet", "-m", "Add the inner library"]);
    await repository.runGitAsync(["-c", "protocol.file.allow=always", "submodule", "--quiet", "add", sources.library, "library"]);
    await repository.runGitAsync(["-c", "protocol.file.allow=always", "submodule", "--quiet", "update", "--init", "--recursive"]);
    const library = path.join(repository.folder, "library");
    await repository.runGitAsync(["config", "filter.evil.clean", "evil-filter"]);
    await repository.runGitAsync(["-C", library, "config", "filter.shallow.process", "shallow-filter"]);
    await repository.runGitAsync(["-C", library, "config", "filter.evil.clean", "evil-filter"]);
    await repository.runGitAsync(["-C", path.join(library, "inner"), "config", "filter.deep.clean", "deep-filter"]);

    assert.deepEqual(await reader.readAsync(repository.folder), [...switchedOff("evil"), ...switchedOff("shallow"), ...switchedOff("deep")]);
  });

  test("lists no submodules of a folder without a .git of its own, so the caller's git run reports a folder outside a repository", async () => {
    const outside = path.join(repository.root, "outside");
    await mkdir(outside);

    assert.deepEqual(await reader.readAsync(outside), []);
  });

  test("fails with git's output when git can't list the submodules, or its answer is cut short", async () => {
    const index = path.join(repository.gitFolder, "index");
    const kept = await readFile(index);
    await writeFile(index, "not an index\n");

    await assert.rejects(reader.readAsync(repository.folder), (error: unknown): boolean => {
      assert.ok(unavailable(GitFailedException, "git ls-files failed; its output comes with the failure as untrusted text.")(error) && error instanceof GitFailedException);
      assert.equal(error.output?.source, UntrustedSource.Repository);
      assert.match(error.output?.text ?? "", /index file/v);
      return true;
    });
    await writeFile(index, kept);
    runner.truncating = "ls-files";
    await assert.rejects(reader.readAsync(repository.folder), unavailable(GitFailedException, "git ls-files failed; its output comes with the failure as untrusted text."));
  });

  test("fails with git's output when git can't read submodule.recurse for a switch, or its answer is cut short", async () => {
    const configuration = path.join(repository.gitFolder, "config");
    const kept = await readFile(configuration);
    await appendFile(configuration, "[broken\n");

    await assert.rejects(reader.checkoutRepositoriesAsync(repository.folder), (error: unknown): boolean => {
      assert.ok(unavailable(GitFailedException, "git config failed; its output comes with the failure as untrusted text.")(error) && error instanceof GitFailedException);
      assert.equal(error.output?.source, UntrustedSource.Repository);
      assert.match(error.output?.text ?? "", /bad config line/v);
      return true;
    });
    await writeFile(configuration, kept);
    runner.truncating = "submodule.recurse";
    await assert.rejects(reader.checkoutRepositoriesAsync(repository.folder), unavailable(GitFailedException, "git config failed; its output comes with the failure as untrusted text."));
  });

  test("refuses to read a repository with more than 256 checked-out submodules", async () => {
    const head = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
    const records = [`160000 ${head}\tabsent`];
    for (let index = 0; index < 257; index++) {
      await mkdir(path.join(repository.folder, `s${index}`, ".git"), { recursive: true });
      records.push(`160000 ${head}\ts${index}`);
    }
    await repository.runGitAsync(["update-index", "--index-info"], `${records.join("\n")}\n`);

    await assert.rejects(reader.readAsync(repository.folder),
      unavailable(FilterSubmodulesTooManyException, "The repository has more than 256 checked-out submodules, more than the module checks for filters, so it stops."));
  });
});
