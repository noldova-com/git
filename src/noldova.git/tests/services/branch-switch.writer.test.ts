/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import { PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FailureCode, GitCode, GitStatus, UntrustedSource } from "@noldova/git.protocol";

import { AlreadyOnBranchException } from "../../src/exceptions/already-on-branch.exception.ts";
import { BranchCheckedOutException } from "../../src/exceptions/branch-checked-out.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { SwitchChangesInTheWayException } from "../../src/exceptions/switch-changes-in-the-way.exception.ts";
import { SwitchDuringOperationException } from "../../src/exceptions/switch-during-operation.exception.ts";
import { SwitchNoBranchException } from "../../src/exceptions/switch-no-branch.exception.ts";
import { SwitchRemoteAmbiguousException } from "../../src/exceptions/switch-remote-ambiguous.exception.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { BranchSwitchWriter } from "../../src/services/branch-switch.writer.ts";
import { CheckoutRisksReader } from "../../src/services/checkout-risks.reader.ts";
import { FilterOptionsReader } from "../../src/services/filter-options.reader.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { HooksReader } from "../../src/services/hooks.reader.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";
import { ScriptedRunnerFixture } from "../fixtures/scripted-runner.fixture.ts";

describe("BranchSwitchWriter", () => {
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;
  let repositories: RepositoryReader;
  let statuses: StatusReader;
  let hooks: HooksReader;
  let risks: CheckoutRisksReader;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
    await template.runGitAsync(["branch", "next"]);
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
    risks = new CheckoutRisksReader(hooks, new FilterOptionsReader(runner));
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const readAsync = async (folder: string = repository.folder): Promise<[RepositoryFolders, GitStatus]> => {
    const folders = await repositories.readAsync(folder);
    return [folders, await statuses.readAsync(folders)];
  };
  const currentAsync = async (folder: string = repository.folder): Promise<string> => (await repository.runGitAsync(["-C", folder, "branch", "--show-current"])).trim();
  const hookAsync = async (name: string, hooksFolder: string = path.join(repository.gitFolder, "hooks")): Promise<void> => {
    await mkdir(hooksFolder, { recursive: true });
    const file = path.join(hooksFolder, name);
    await writeFile(file, "#!/bin/sh\nexit 0\n");
    await chmod(file, 0o755);
  };
  const call = { session: "session-1", requestPermissionAsync: () => Promise.reject(new Error("never raised here")), markSending: () => undefined };
  const always = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  const failsWith = (type: abstract new (...args: never[]) => GitFailureException, code: FailureCode, gitCode: GitCode | null, message?: string) => (error: unknown): boolean =>
    error instanceof type && error.code === code && error.gitCode === gitCode && (message === undefined || error.message === message);

  test("asks an agent's switch when the repository's hooks can't be read, saying so", async () => {
    const hook = path.join(repository.gitFolder, "hooks", "post-index-change");
    await symlink(hook, hook, "junction");
    const [folders, status] = await readAsync();
    const hooksDetail = { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "Unknown: the hooks couldn't be read, so any of them may run" };

    const switching = new BranchSwitchWriter(runner, new CheckoutRisksReader(hooks, new FilterOptionsReader(runner)), "next");
    assert.deepEqual((await switching.requestAsync(folders, status, call))?.details[1], hooksDetail);
  });

  test("refuses to switch during a merge or to the branch HEAD is on", async () => {
    const [, status] = await readAsync();
    const head = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
    assert.throws(() => new BranchSwitchWriter(runner, risks, "main").refuse(status), failsWith(AlreadyOnBranchException, FailureCode.Refused, null, "HEAD is already on main."));

    await writeFile(path.join(repository.gitFolder, "MERGE_HEAD"), `${head}\n`);
    const [, merging] = await readAsync();
    assert.throws(() => new BranchSwitchWriter(runner, risks, "next").refuse(merging), failsWith(SwitchDuringOperationException, FailureCode.Git, GitCode.Conflict));
    assert.doesNotThrow(() => new BranchSwitchWriter(runner, risks, "next").refuse(status));
  });

  test("runs in a submodule exactly the hooks that the request names when a recursive switch moves it", async () => {
    const source = path.join(repository.root, "library");
    await repository.runGitAsync(["init", "--quiet", source]);
    await writeFile(path.join(source, "library.txt"), "a");
    await repository.runGitAsync(["-C", source, "add", "library.txt"]);
    await repository.runGitAsync(["-C", source, "commit", "--quiet", "-m", "library"]);
    await repository.runGitAsync(["-c", "protocol.file.allow=always", "submodule", "--quiet", "add", source, "library"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Add the library"]);
    const library = path.join(repository.folder, "library");
    const first = (await repository.runGitAsync(["-C", library, "rev-parse", "HEAD"])).trim();
    await writeFile(path.join(source, "library.txt"), "b");
    await repository.runGitAsync(["-C", source, "commit", "--quiet", "-am", "Change the library"]);
    const second = (await repository.runGitAsync(["-C", source, "rev-parse", "HEAD"])).trim();
    await repository.runGitAsync(["-C", library, "-c", "protocol.file.allow=always", "fetch", "--quiet"]);
    await repository.runGitAsync(["branch", "moved"]);
    await repository.runGitAsync(["switch", "--quiet", "moved"]);
    await repository.runGitAsync(["-C", library, "checkout", "--quiet", second]);
    await repository.runGitAsync(["add", "library"]);
    await repository.runGitAsync(["commit", "--quiet", "-m", "Move the library"]);
    await repository.runGitAsync(["switch", "--quiet", "main"]);
    await repository.runGitAsync(["-C", library, "checkout", "--quiet", first]);
    const gitFolder = (await repository.runGitAsync(["-C", library, "rev-parse", "--absolute-git-dir"])).trim();
    await mkdir(path.join(gitFolder, "hooks"), { recursive: true });
    for (const name of ["post-checkout", "post-merge", "post-index-change", "reference-transaction", "post-rewrite"])
      await writeFile(path.join(gitFolder, "hooks", name), `#!/bin/sh\necho ${name} >> "$(git rev-parse --absolute-git-dir)/fired"\n`).then(() => chmod(path.join(gitFolder, "hooks", name), 0o755));
    await repository.runGitAsync(["config", "submodule.recurse", "true"]);
    const write = new BranchSwitchWriter(runner, risks, "moved");
    const named = (await write.requestAsync(...await readAsync(), call))?.details[1]?.value;

    await write.runAsync(...await readAsync());

    const fired = [...new Set((await readFile(path.join(gitFolder, "fired"), "utf8")).split(/\s+/v).filter(t => t.length > 0))];
    assert.equal((await repository.runGitAsync(["-C", library, "rev-parse", "HEAD"])).trim(), second);
    assert.deepEqual([fired.sort(), named], [["post-index-change", "reference-transaction"], "post-index-change (library), reference-transaction (library)"]);
  });

  test("names the smudge or process filters the repository's own configuration names in an agent's switch, never the person's own", async () => {
    const own = path.join(repository.configuration, "git");
    await mkdir(own, { recursive: true });
    await repository.runGitAsync(["config", "--file", path.join(own, "config"), "filter.own.smudge", "own-filter"]);
    await repository.runGitAsync(["config", "filter.crypt.clean", "crypt-filter"]);
    const write = new BranchSwitchWriter(runner, risks, "next");
    const without = (await write.requestAsync(...await readAsync(), call))?.details.length;
    await repository.runGitAsync(["config", "filter.smudged.smudge", "smudge-filter"]);
    await repository.runGitAsync(["config", "filter.lfs.process", "lfs-filter"]);

    const request = await write.requestAsync(...await readAsync(), call);

    assert.deepEqual([without, request?.risk, request?.details[2]], [2, ToolRisk.Medium,
      { label: "Filters that will run", kind: PermissionDetailKind.Text, value: "smudged, lfs" }]);
  });

  test("names each checked-out submodule's hooks and smudge filters too, at any depth, once submodule.recurse makes the switch check them out", async () => {
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
    const library = path.join(repository.folder, "library");
    await repository.runGitAsync(["config", "filter.top.smudge", "top-filter"]);
    await repository.runGitAsync(["-C", library, "config", "filter.shallow.process", "shallow-filter"]);
    await repository.runGitAsync(["-C", path.join(library, "inner"), "config", "filter.deep.smudge", "deep-filter"]);
    const hooksOf = async (folder: string): Promise<string> =>
      (await repository.runGitAsync(["-C", folder, "rev-parse", "--path-format=absolute", "--git-path", "hooks"])).trim();
    await hookAsync("post-checkout");
    await hookAsync("post-checkout", await hooksOf(library));
    await hookAsync("post-index-change", await hooksOf(library));
    await hookAsync("reference-transaction", await hooksOf(path.join(library, "inner")));
    const write = new BranchSwitchWriter(runner, risks, "next");
    const alone = (await write.requestAsync(...await readAsync(), call))?.details;
    await repository.runGitAsync(["config", "submodule.recurse", "true"]);

    const request = await write.requestAsync(...await readAsync(), call);

    assert.deepEqual([alone?.[1]?.value, alone?.[2]?.value], ["post-checkout", "top"]);
    assert.deepEqual([request?.details[1]?.value, request?.details[2]?.value],
      ["post-checkout, post-index-change (library), reference-transaction (library/inner)", "top, shallow, deep"]);
  });

  test("asks an agent's switch at medium risk, from and to, with how many unstaged changes stay", async () => {
    const write = new BranchSwitchWriter(runner, risks, "next");
    const [folders, clean] = await readAsync();
    assert.deepEqual(await write.requestAsync(folders, clean, call), {
      action: "git.switchBranch",
      subject: folders.top,
      title: "Switch from main to next",
      details: [
        { label: "Changes", kind: PermissionDetailKind.Text, value: "There are no unstaged changes." },
        { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "None" }
      ],
      risk: ToolRisk.Medium,
      options: always,
      labels: { [PermissionOption.AllowAlways]: "Always allow in this repository" }
    });
    await hookAsync("post-checkout");
    assert.equal((await write.requestAsync(folders, clean, call))?.details[1]?.value, "post-checkout");

    await repository.writeAsync("a.txt", "changed\n");
    await repository.writeAsync("b.txt", "new\n");
    await repository.writeAsync("c.txt", "staged\n");
    await repository.runGitAsync(["add", "c.txt"]);
    const [, changed] = await readAsync();
    assert.equal((await write.requestAsync(folders, changed, call))?.details[0]?.value,
      "Your 2 unstaged changes stay in the folder. Git refuses the switch if one of them would be overwritten.");
    const cut = new GitStatus(changed.branch, changed.head, changed.upstream, changed.entries, true, changed.fingerprint, changed.operation, changed.remote);
    assert.equal((await write.requestAsync(folders, cut, call))?.details[0]?.value,
      "Your unstaged changes stay in the folder: 2 unstaged changes and maybe more, since the status was cut short. Git refuses the switch if one of them would be overwritten.");

    await repository.runGitAsync(["switch", "--quiet", "--detach"]);
    await repository.runGitAsync(["restore", "--staged", "c.txt"]);
    await repository.runGitAsync(["clean", "--quiet", "--force"]);
    const [, detached] = await readAsync();
    const asked = await write.requestAsync(folders, detached, call);
    assert.equal(asked?.title, "Switch from a detached HEAD to next");
    assert.equal(asked?.details[0]?.value, "Your 1 unstaged change stays in the folder. Git refuses the switch if one of them would be overwritten.");
  });

  test("names the remote branch an agent's switch makes a new branch from and tracks, with checkout.defaultRemote breaking a tie", async () => {
    await repository.runGitAsync(["remote", "add", "origin", repository.folder]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/feature", "HEAD"]);
    const [folders, status] = await readAsync();
    const titleAsync = async (name: string): Promise<string | undefined> => (await new BranchSwitchWriter(runner, risks, name).requestAsync(folders, status, call))?.title;
    const one = await titleAsync("feature");
    await repository.runGitAsync(["remote", "add", "upstream", repository.folder]);
    await repository.runGitAsync(["update-ref", "refs/remotes/upstream/feature", "HEAD"]);
    await repository.runGitAsync(["config", "checkout.defaultRemote", "upstream"]);

    assert.deepEqual([one, await titleAsync("feature"), await titleAsync("next")],
      ["Switch from main to feature, a new branch tracking origin/feature", "Switch from main to feature, a new branch tracking upstream/feature", "Switch from main to next"]);
    await new BranchSwitchWriter(runner, risks, "feature").runAsync(folders, status);
    assert.equal((await repository.runGitAsync(["rev-parse", "--abbrev-ref", "feature@{upstream}"])).trim(), "upstream/feature");
  });

  test("refuses an agent's switch to a name no remote has, or several have with no checkout.defaultRemote naming one, which git itself refuses", async () => {
    await repository.runGitAsync(["update-ref", "refs/remotes/stray/feature", "HEAD"]);
    const [folders, status] = await readAsync();
    const write = (name: string): BranchSwitchWriter => new BranchSwitchWriter(runner, risks, name);
    const none = (error: unknown): boolean => error instanceof SwitchNoBranchException && error.branch === "feature" && error.code === FailureCode.Refused && error.gitCode === null
      && error.message === "There is no branch named feature here or on a remote, so there is nothing to switch to. Check the name, or fetch first.";

    await assert.rejects(write("feature").requestAsync(folders, status, call), none);
    await assert.rejects(write("feature").runAsync(folders, status), GitFailedException);
    await repository.runGitAsync(["remote", "add", "origin", repository.folder]);
    await repository.runGitAsync(["remote", "add", "upstream", repository.folder]);
    await assert.rejects(write("feature").requestAsync(folders, status, call), none);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/feature", "HEAD"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/upstream/feature", "HEAD"]);
    await assert.rejects(write("feature").requestAsync(folders, status, call), SwitchRemoteAmbiguousException);
    await repository.runGitAsync(["config", "checkout.defaultRemote", "stray"]);
    await assert.rejects(write("feature").requestAsync(folders, status, call), (error: unknown) => error instanceof SwitchRemoteAmbiguousException && error.branch === "feature"
      && error.code === FailureCode.Refused && error.gitCode === null && error.remotes.join() === "origin,upstream"
      && error.message === "The remotes origin, upstream each have a branch named feature, and checkout.defaultRemote names none of them, so git can't tell which one a new branch would track. Set checkout.defaultRemote, or create the branch from the remote branch you want.");
    await assert.rejects(write("feature").runAsync(folders, status), GitFailedException);
    assert.equal(await currentAsync(), "main");
  });

  test("fails with git's output, marked untrusted, when it can't read the branch, the remotes, their branches or checkout.defaultRemote", async () => {
    await repository.runGitAsync(["remote", "add", "origin", repository.folder]);
    await repository.runGitAsync(["remote", "add", "upstream", repository.folder]);
    await repository.runGitAsync(["update-ref", "refs/remotes/origin/feature", "HEAD"]);
    await repository.runGitAsync(["update-ref", "refs/remotes/upstream/feature", "HEAD"]);
    await repository.runGitAsync(["config", "checkout.defaultRemote", "stray"]);
    const [folders, status] = await readAsync();
    const scripted = new ScriptedRunnerFixture(supervisor.context);
    const request = (): Promise<unknown> => new BranchSwitchWriter(scripted, new CheckoutRisksReader(new HooksReader(scripted), new FilterOptionsReader(scripted)), "feature")
      .requestAsync(folders, status, call);
    const failed = (command: string) => (error: unknown): boolean => error instanceof GitFailedException && error.code === FailureCode.Unavailable && error.command === command
      && error.output?.source === UntrustedSource.Repository;
    scripted.failingCode = 128;

    scripted.failing = "show-ref";
    await assert.rejects(request(), failsWith(GitFailedException, FailureCode.Unavailable, null, "git show-ref --verify failed; its output comes with the failure as untrusted text."));
    scripted.failing = "remote";
    await assert.rejects(request(), failed("remote"));
    scripted.failing = "for-each-ref";
    await assert.rejects(request(), failed("for-each-ref --format=%(refname)"));
    scripted.failing = "checkout.defaultRemote";
    await assert.rejects(request(), failed("config --get"));
    scripted.failing = null;
    scripted.truncating = "checkout.defaultRemote";
    await assert.rejects(request(), failed("config --get"));
  });

  test("switches to another branch, keeping the worktree's changes", async () => {
    await repository.writeAsync("b.txt", "new\n");

    await new BranchSwitchWriter(runner, risks, "next").runAsync(...await readAsync());

    assert.equal(await currentAsync(), "next");
    assert.equal(await repository.runGitAsync(["status", "--porcelain=v1", "--untracked-files=all"]), "?? b.txt\n");
  });

  test("names the files a switch would overwrite, from git's refusal", async () => {
    await repository.runGitAsync(["switch", "--quiet", "next"]);
    await repository.writeAsync("a.txt", "next\n");
    await repository.runGitAsync(["commit", "--quiet", "-am", "Next"]);
    await repository.runGitAsync(["switch", "--quiet", "main"]);
    await repository.writeAsync("a.txt", "mine\n");

    await assert.rejects(new BranchSwitchWriter(runner, risks, "next").runAsync(...await readAsync()), failsWith(SwitchChangesInTheWayException, FailureCode.Git, GitCode.ChangesInTheWay,
      "Switching would overwrite your changes to a.txt, so git didn't switch. Commit or stash them first."));

    assert.equal(await currentAsync(), "main");
  });

  test("fails as BranchCheckedOut for a branch another worktree has, and with git's output for any other refusal", async () => {
    await repository.runGitAsync(["worktree", "add", "--quiet", path.join(repository.root, "other"), "next"]);
    await assert.rejects(new BranchSwitchWriter(runner, risks, "next").runAsync(...await readAsync()), failsWith(BranchCheckedOutException, FailureCode.Git, GitCode.BranchCheckedOut,
      "next is checked out in another worktree, so git didn't switch to it."));

    await assert.rejects(new BranchSwitchWriter(runner, risks, "missing").runAsync(...await readAsync()), failsWith(GitFailedException, FailureCode.Unavailable, null,
      "git switch failed; its output comes with the failure as untrusted text."));
  });
});
