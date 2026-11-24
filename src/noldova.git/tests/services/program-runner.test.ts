/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import path from "node:path";
import timers from "node:timers";

import { afterAll, afterEach, beforeAll, beforeEach, describe, onTestFinished, test, vi } from "vitest";

import { ProcessStartFailedException } from "@noldova/desktop.runtime";
import { FailureCode, GitCode } from "@noldova/git.protocol";

import { Access } from "../../src/enums/access.ts";
import { GhMissingException } from "../../src/exceptions/gh-missing.exception.ts";
import { GitMissingException } from "../../src/exceptions/git-missing.exception.ts";
import { IndexLockedException } from "../../src/exceptions/index-locked.exception.ts";
import { ProgramTimedOutException } from "../../src/exceptions/program-timed-out.exception.ts";
import { GitArguments } from "../../src/models/git-arguments.ts";
import { ProgramLimits } from "../../src/models/program-limits.ts";
import { ProgramRun } from "../../src/models/program-run.ts";
import { CommandLog } from "../../src/services/command-log.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { FakeGhFixture } from "../fixtures/fake-gh.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

describe("ProgramRunner", () => {
  const limits = new ProgramLimits(1024 * 1024, 30_000);
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let runner: ProgramRunner;

  beforeAll(async () => {
    template = await RepositoryFixture.createAsync();
  });

  afterAll(async () => {
    await template.disposeAsync();
  });

  beforeEach(async () => {
    repository = await RepositoryFixture.createAsync(template);
    cleanUps.add(() => repository.disposeAsync());
    await FakeGhFixture.createAsync(repository.programs);
    supervisor = await DesktopFixture.createAsync(repository.supervisorEnvironment([repository.programs, process.env["PATH"] ?? ""].join(path.delimiter)));
    cleanUps.add(() => supervisor.disposeAsync());
    runner = new ProgramRunner(supervisor.context);
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const write = (gitArguments: GitArguments, gitFolder: string = repository.gitFolder): ProgramRun =>
    ProgramRun.writeGit(gitArguments, repository.folder, gitFolder, repository.gitFolder, limits);

  const mockClock = (): { readonly expire: () => void } => {
    const clock = { expire: (): void => undefined };
    const original = timers.setTimeout;
    const timer = vi.spyOn(timers, "setTimeout").mockImplementation((...values: Parameters<typeof timers.setTimeout>) => {
      const [handler, delay] = values;
      if (delay === limits.milliseconds && typeof handler === "function")
        clock.expire = () => handler();
      return original(...values);
    });
    onTestFinished(() => timer.mockRestore());
    return clock;
  };

  test("a git read passes --no-optional-locks and the request's environment", async () => {
    const result = await runner.runAsync(ProgramRun.readGit(new GitArguments(["rev-parse", "--is-inside-work-tree"]), repository.folder, limits));

    assert.equal(result.output.toString(), "true\n");
    assert.equal(result.exit.code, 0);
    assert.equal(result.isTruncated, false);
    const [request] = supervisor.requests;
    assert.equal(request?.program, "git");
    assert.deepEqual(request?.arguments, ["-c", "core.fsmonitor=false", "--no-optional-locks", "rev-parse", "--is-inside-work-tree"]);
    assert.equal(request?.environment["GIT_TERMINAL_PROMPT"], "0");
    assert.equal(request?.inherit.includes("GH_CONFIG_DIR"), true);
  });

  test("a read gets its input on standard input, and a program that never reads it still finishes", async () => {
    const hash = await runner.runAsync(ProgramRun.readGit(new GitArguments(["hash-object", "--stdin"]), repository.folder, limits).withInput(Buffer.from("abc")));
    const unread = await runner.runAsync(ProgramRun.readGit(new GitArguments(["rev-parse", "--is-inside-work-tree"]), repository.folder, limits)
      .withInput(Buffer.alloc(8 * 1024 * 1024, 120)));

    assert.deepEqual([hash.output.toString(), hash.exit.code], ["f2ba8f84ab5c1bce84a7b441cb1959cfc7093b7f\n", 0]);
    assert.deepEqual([unread.output.toString(), unread.exit.code], ["true\n", 0]);
  });

  test("a git write turns fsmonitor off before its arguments, and a gh run passes its arguments unchanged", async () => {
    await repository.writeAsync("b.txt", "b\n");

    const staged = await runner.runAsync(write(new GitArguments(["add"]).withPaths(["b.txt"])));
    const printed = await runner.runAsync(ProgramRun.runGh(Access.Read, ["print"], repository.folder, limits));

    assert.equal(staged.exit.code, 0);
    assert.equal(printed.output.toString(), "printed\n");
    assert.deepEqual(supervisor.requests.map(t => [t.program, ...t.arguments]), [["git", "-c", "core.fsmonitor=false", "add", "--", ":(literal)b.txt"], ["gh", "print"]]);
    assert.equal(await repository.runGitAsync(["diff", "--cached", "--name-only"]), "b.txt\n");
  });

  test("writes to one repository run one at a time, in the order they were asked for, whatever form names its git folder", async () => {
    await repository.writeAsync("b.txt", "b\n");
    await repository.writeAsync("c.txt", "c\n");
    const otherForm = `${repository.gitFolder.toUpperCase()}${path.sep}`;

    await Promise.all([
      runner.runAsync(write(new GitArguments(["add"]).withPaths(["b.txt"]))),
      runner.runAsync(ProgramRun.writeGit(new GitArguments(["add"]).withPaths(["c.txt"]), repository.folder, repository.gitFolder, otherForm, limits))
    ]);

    assert.deepEqual(supervisor.events, [
      "start -c core.fsmonitor=false add -- :(literal)b.txt",
      "exit -c core.fsmonitor=false add -- :(literal)b.txt",
      "start -c core.fsmonitor=false add -- :(literal)c.txt",
      "exit -c core.fsmonitor=false add -- :(literal)c.txt"
    ]);
  });

  test("a write that fails on a held index.lock reports it and leaves the lock", async () => {
    const lock = path.join(repository.gitFolder, "index.lock");
    await writeFile(lock, "");
    await repository.writeAsync("b.txt", "b\n");

    await assert.rejects(runner.runAsync(write(new GitArguments(["add"]).withPaths(["b.txt"]))), (error: unknown) =>
      error instanceof IndexLockedException && error.code === FailureCode.Git && error.gitCode === GitCode.IndexLocked);
    await access(lock);
  });

  test("a write that fails for another reason while index.lock is held returns its exit", async () => {
    await writeFile(path.join(repository.gitFolder, "index.lock"), "");
    await repository.writeAsync("a.txt", "changed\n");

    const result = await runner.runAsync(write(new GitArguments(["diff", "--quiet"])));

    assert.equal(result.exit.code, 1);
  });

  test("a write that fails as fatal for another reason while index.lock is held returns its exit and errors", async () => {
    await writeFile(path.join(repository.gitFolder, "index.lock"), "");

    const result = await runner.runAsync(write(new GitArguments(["rev-parse", "--verify", "missing"])));

    assert.equal(result.exit.code, 128);
    assert.match(result.errors.toString(), /^fatal: Needed a single revision/v);
    await access(path.join(repository.gitFolder, "index.lock"));
  });

  test("a write that fails without index.lock returns its exit and errors", async () => {
    const result = await runner.runAsync(write(new GitArguments(["add"]).withPaths(["missing.txt"])));

    assert.equal(result.exit.code, 128);
    assert.match(result.errors.toString(), /missing\.txt/v);
  });

  test("output over the limit is cut at the limit, and the program is stopped", async () => {
    await repository.writeAsync("big.txt", Buffer.alloc(2 * 1024 * 1024, "x"));
    await repository.runGitAsync(["add", "big.txt"]);
    const show = new GitArguments(["cat-file", "blob"]).withRevisions([":big.txt"]);

    const result = await runner.runAsync(ProgramRun.readGit(show, repository.folder, new ProgramLimits(1024 * 1024, 30_000)));

    assert.equal(result.isTruncated, true);
    assert.equal(result.output.length, 1024 * 1024);
    assert.deepEqual(supervisor.events, ["start -c core.fsmonitor=false --no-optional-locks cat-file blob --end-of-options :big.txt", "exit -c core.fsmonitor=false --no-optional-locks cat-file blob --end-of-options :big.txt"]);
  });

  test("output exactly at the limit is whole", async () => {
    const result = await runner.runAsync(ProgramRun.runGh(Access.Read, ["print"], repository.folder, new ProgramLimits("printed\n".length, 30_000)));

    assert.equal(result.isTruncated, false);
    assert.equal(result.output.toString(), "printed\n");
  });

  test("errors are drained to their end and kept up to 64 KiB", async () => {
    const result = await runner.runAsync(ProgramRun.runGh(Access.Read, ["errors", "200000"], repository.folder, limits));

    assert.equal(result.exit.code, 0);
    assert.equal(result.errors.length, 64 * 1024);
    assert.equal(result.isTruncated, false);
  });

  test("a git or gh that can't be found fails as missing, with the base's cause", async () => {
    const empty = path.join(repository.root, "empty");
    await mkdir(empty);
    const emptyPath = await DesktopFixture.createAsync(repository.supervisorEnvironment(empty));
    onTestFinished(() => emptyPath.disposeAsync());
    const missing = new ProgramRunner(emptyPath.context);

    await assert.rejects(missing.runAsync(ProgramRun.readGit(new GitArguments(["status"]), repository.folder, limits)), (error: unknown) =>
      error instanceof GitMissingException && error.code === FailureCode.Git && error.gitCode === GitCode.GitMissing && error.program === "git" && error.cause instanceof Error);
    await assert.rejects(missing.runAsync(ProgramRun.runGh(Access.Read, ["print"], repository.folder, limits)), (error: unknown) =>
      error instanceof GhMissingException && error.gitCode === GitCode.GhMissing && error.message === "gh isn't found or can't be started.");
  });

  test("a git that is found but can't start in a removed folder fails with Desktop's start failure, never as missing", async () => {
    const deleted = path.join(repository.root, "deleted");

    await assert.rejects(runner.runAsync(ProgramRun.readGit(new GitArguments(["status"]), deleted, limits)), (error: unknown) =>
      error instanceof ProcessStartFailedException && error.cause instanceof Error);
  });

  test("a run past its time limit is stopped and fails as timed out", async () => {
    const clock = mockClock();
    const started = supervisor.waitForStartAsync();

    const running = runner.runAsync(ProgramRun.runGh(Access.Read, ["hang"], repository.folder, limits));
    await started;
    clock.expire();

    await assert.rejects(running, (error: unknown) =>
      error instanceof ProgramTimedOutException && error.code === FailureCode.TimedOut && error.gitCode === null && error.milliseconds === 30_000 && error.message === "gh did not finish within 30000 ms, so it was stopped.");
    assert.deepEqual(supervisor.events, ["start hang", "exit hang"]);
  });

  test("an aborted run is stopped and fails with the signal's reason", async () => {
    const controller = new AbortController();
    const reason = new Error("The person cancelled.");
    const started = supervisor.waitForStartAsync();

    const running = runner.runAsync(ProgramRun.runGh(Access.Read, ["hang"], repository.folder, limits, controller.signal));
    await started;
    controller.abort(reason);

    await assert.rejects(running, reason);
    assert.deepEqual(supervisor.events, ["start hang", "exit hang"]);
  });

  test("an aborted run fails with the signal's reason once its program exits, though a process it started still holds its output", async () => {
    const controller = new AbortController();
    const reason = new Error("The person cancelled.");
    const sockets: Socket[] = [];
    const connected = Promise.withResolvers<void>();
    const server = createServer(socket => {
      sockets.push(socket.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code !== "ECONNRESET")
          throw error;
      }));
      if (sockets.length === 2)
        connected.resolve();
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address !== null && typeof address === "object");
    const port = String(address.port);

    try {
      const running = runner.runAsync(ProgramRun.runGh(Access.Read, ["escape", port], repository.folder, limits, controller.signal));
      await connected.promise;
      controller.abort(reason);

      await assert.rejects(running, reason);
      assert.deepEqual(supervisor.events, [`start escape ${port}`, `exit escape ${port}`]);
    } finally {
      for (const socket of sockets)
        socket.destroy();
      server.close();
    }
  });

  test("a signal aborted before the start fails with its reason and starts nothing", async () => {
    const reason = new Error("Already cancelled.");

    await assert.rejects(runner.runAsync(ProgramRun.readGit(new GitArguments(["status"]), repository.folder, limits, AbortSignal.abort(reason))), reason);
    assert.deepEqual(supervisor.events, []);
  });

  test("with a command log, it logs each git write with its exit code, or none when it didn't run to its end, and leaves out reads and unlogged writes", async () => {
    const commands = new CommandLog();
    const logged = new ProgramRunner(supervisor.context, commands);
    await repository.writeAsync("b.txt", "b\n");

    await logged.runAsync(write(new GitArguments(["add"]).withPaths(["b.txt"])));
    await logged.runAsync(write(new GitArguments(["switch", "missing"])));
    await logged.runAsync(write(new GitArguments(["write-tree"])).unlogged());
    await logged.runAsync(ProgramRun.readGit(new GitArguments(["status"]), repository.folder, limits));
    const reason = new Error("Already cancelled.");
    await assert.rejects(logged.runAsync(ProgramRun.writeGit(new GitArguments(["gc"]), repository.folder, repository.gitFolder, repository.gitFolder, limits,
      AbortSignal.abort(reason))), reason);

    assert.deepEqual(commands.read(repository.gitFolder).commands.map(t => [t.line, t.exitCode]), [
      ["git add -- :(literal)b.txt", 0], ["git switch missing", 128], ["git gc", null]
    ]);
  });
});
