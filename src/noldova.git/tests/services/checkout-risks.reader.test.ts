/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { CheckoutRisks } from "../../src/models/checkout-risks.ts";
import { Resources } from "../../src/resources.ts";
import { CheckoutRisksReader } from "../../src/services/checkout-risks.reader.ts";
import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("CheckoutRisksReader", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let risks: CheckoutRisksReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment());
    cleanUps.add(() => supervisor.disposeAsync());
    const runner = new ProgramRunner(supervisor.context);
    risks = new CheckoutRisksReader(new HooksReader(runner), new FilterOptionsReader(runner));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const hookAsync = async (folder: string, name: string): Promise<void> => {
    const hooks = (await repository.runGitAsync(["-C", folder, "rev-parse", "--path-format=absolute", "--git-path", "hooks"])).trim();
    await mkdir(hooks, { recursive: true });
    await writeFile(path.join(hooks, name), "#!/bin/sh\nexit 0\n");
    await chmod(path.join(hooks, name), 0o755);
  };
  const addLibrariesAsync = async (): Promise<string> => {
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
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add the library"]);
    return path.join(repository.folder, "library");
  };

  test("names the repository's own hooks of the write's names and its smudge or process filters, and nothing when it has none", async () => {
    assert.deepEqual(await risks.readAsync(repository.folder, ["post-merge"], []), new CheckoutRisks([], []));

    await hookAsync(repository.folder, "post-merge");
    await hookAsync(repository.folder, "post-checkout");
    await repository.runGitAsync(["config", "filter.crypt.clean", "crypt-filter"]);
    await repository.runGitAsync(["config", "filter.lfs.process", "lfs-filter"]);

    assert.deepEqual(await risks.readAsync(repository.folder, ["post-merge"], []), new CheckoutRisks(["post-merge"], ["lfs"]));
  });

  test("names each checked-out submodule's hooks of the submodule names, with its path, at any depth, and each filter once, only with submodule.recurse", async () => {
    const library = await addLibrariesAsync();
    await hookAsync(repository.folder, "post-merge");
    await hookAsync(library, "post-merge");
    await hookAsync(library, "post-checkout");
    await hookAsync(library, "post-index-change");
    await hookAsync(path.join(library, "inner"), "reference-transaction");
    await repository.runGitAsync(["config", "filter.shared.smudge", "shared-filter"]);
    await repository.runGitAsync(["-C", library, "config", "filter.shared.smudge", "shared-filter"]);
    await repository.runGitAsync(["-C", path.join(library, "inner"), "config", "filter.deep.process", "deep-filter"]);
    const alone = await risks.readAsync(repository.folder, ["post-merge"], Resources.moveHooks);
    await repository.runGitAsync(["config", "submodule.recurse", "true"]);

    const recursing = await risks.readAsync(repository.folder, ["post-merge"], Resources.moveHooks);

    assert.deepEqual(alone, new CheckoutRisks(["post-merge"], ["shared"]));
    assert.deepEqual(recursing, new CheckoutRisks(["post-merge", "post-index-change (library)", "reference-transaction (library/inner)"], ["shared", "deep"]));
    assert.deepEqual([Resources.checkoutHooks, Resources.moveHooks],
      [["post-checkout", "post-index-change", "reference-transaction"], ["post-index-change", "reference-transaction"]]);
  });
});
