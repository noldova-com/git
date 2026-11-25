/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from "vitest";

import {
  type IPermissionRequest,
  PermissionDecision,
  PermissionOption,
  PermissionOutcome,
  ToolCall,
  ToolRisk
} from "@noldova/desktop.runtime";
import { FailureCode, GitCode, GitRefMove, type GitStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { NothingStagedException } from "../../src/exceptions/nothing-staged.exception.ts";
import { ProgramTimedOutException } from "../../src/exceptions/program-timed-out.exception.ts";
import { RequestDeniedException } from "../../src/exceptions/request-denied.exception.ts";
import { RequestExpiredException } from "../../src/exceptions/request-expired.exception.ts";
import { RequestMovedException } from "../../src/exceptions/request-moved.exception.ts";
import { RequestWithdrawnException } from "../../src/exceptions/request-withdrawn.exception.ts";
import { StatusMovedException } from "../../src/exceptions/status-moved.exception.ts";
import { WriteOutcomeUnknownException } from "../../src/exceptions/write-outcome-unknown.exception.ts";
import type { IGitWrite } from "../../src/interfaces/i-git-write.ts";
import type { RefSnapshot } from "../../src/models/ref-snapshot.ts";
import type { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { GitVersionReader } from "../../src/services/git-version.reader.ts";
import { Journal } from "../../src/services/journal.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";
import { RefSnapshotReader } from "../../src/services/ref-snapshot.reader.ts";
import { RepositoryReader } from "../../src/services/repository.reader.ts";
import { StatusReader } from "../../src/services/status.reader.ts";
import { WriteRunner } from "../../src/services/write.runner.ts";
import { CleanUps } from "../fixtures/clean-ups.fixture.ts";
import { DesktopFixture } from "../fixtures/desktop.fixture.ts";
import { RepositoryFixture } from "../fixtures/repository.fixture.ts";

class RecordingWrite implements IGitWrite {
  public readonly method: string = "git.test";
  public undo: UndoMode = UndoMode.Refs;
  public refusal: Error | null = null;
  public failure: unknown = null;
  public readonly requests: (IPermissionRequest | null)[];
  public readonly asked: GitStatus[] = [];
  public readonly ran: GitStatus[] = [];
  public onRun: () => Promise<void> = () => Promise.resolve();

  public constructor(...requests: (IPermissionRequest | null)[]) {
    this.requests = requests;
  }

  public refuse(): void {
    if (this.refusal !== null)
      throw this.refusal;
  }

  public requestAsync(_folders: RepositoryFolders, status: GitStatus): Promise<IPermissionRequest | null> {
    this.asked.push(status);
    return Promise.resolve(this.requests[Math.min(this.asked.length, this.requests.length) - 1] ?? null);
  }

  public async runAsync(_folders: RepositoryFolders, status: GitStatus): Promise<void> {
    this.ran.push(status);
    await this.onRun();
    if (this.failure !== null)
      throw this.failure;
  }
}

// Reads the refs before a write as they are, and then fails as `failure` says, as a repository that can't be read after the write.
class FailingAfterReader extends RefSnapshotReader {
  private reads: number = 0;
  public failure: Error = new Error("unread");

  public override async readAsync(folders: RepositoryFolders, withIndex: boolean, signal?: AbortSignal): Promise<RefSnapshot> {
    this.reads += 1;
    if (this.reads > 1)
      throw this.failure;
    return super.readAsync(folders, withIndex, signal);
  }
}

/** A person's answer that runs no write, and the failure the write then ends with. */
interface IUnansweredCase {
  readonly decision: PermissionDecision;
  readonly code: FailureCode;
  readonly type: abstract new (...args: never[]) => GitFailureException;
}

describe("WriteRunner", () => {
  const request = (subject: string): IPermissionRequest => ({
    action: "git.switchBranch",
    subject,
    title: "Switch from main to next",
    details: [],
    risk: ToolRisk.Medium,
    options: [PermissionOption.AllowOnce, PermissionOption.Deny]
  });
  let template: RepositoryFixture;
  let repository: RepositoryFixture;
  const cleanUps: CleanUps = new CleanUps();
  let supervisor: DesktopFixture;
  let statuses: StatusReader;
  let folders: RepositoryFolders;
  let writing: string[];
  let written: string[];
  let writes: WriteRunner;
  let runner: ProgramRunner;
  let journal: Journal;
  let shown: IPermissionRequest[];

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
    runner = new ProgramRunner(supervisor.context);
    statuses = new StatusReader(runner);
    folders = await new RepositoryReader(runner, new GitVersionReader(runner)).readAsync(repository.folder);
    writing = [];
    written = [];
    journal = new Journal();
    writes = new WriteRunner(statuses, new RefSnapshotReader(runner), journal, t => writing.push(t), t => written.push(t));
    shown = [];
  });

  afterEach(async () => {
    await cleanUps.runAsync();
  });

  const basedOnAsync = async (): Promise<string> => (await statuses.readAsync(folders)).fingerprint;
  const callOf = (decision: PermissionDecision, onAsk: () => Promise<void> = () => Promise.resolve()): ToolCall =>
    new ToolCall("session-1", "conversation-1", {}, {}, Date.now() + 60_000, new AbortController().signal, {
      requestAsync: async t => {
        shown.push(t);
        await onAsk();
        return new PermissionOutcome(decision);
      }
    });
  const rejectsAsync = async (type: abstract new (...args: never[]) => GitFailureException, running: Promise<void>, code: FailureCode, gitCode: GitCode | null = null): Promise<void> => {
    await assert.rejects(running, (error: unknown) => error instanceof type && error.code === code && error.gitCode === gitCode);
  };

  test("runs a person's write on the status it is based on without asking, telling the repository is being written and then was written", async () => {
    const write = new RecordingWrite(request("asked"));
    const basedOn = await basedOnAsync();

    await writes.runAsync(folders, basedOn, write, null);

    assert.deepEqual(write.ran.map(t => t.fingerprint), [basedOn]);
    assert.equal(write.asked.length, 0);
    assert.deepEqual([writing, written], [[folders.top], [folders.top]]);
  });

  test("refuses a status that moved since the write was based on it, before anything asks or runs", async () => {
    const write = new RecordingWrite(request("asked"));
    const basedOn = await basedOnAsync();
    await repository.writeAsync("a.txt", "changed\n");

    await rejectsAsync(StatusMovedException, writes.runAsync(folders, basedOn, write, callOf(PermissionDecision.AllowedOnce)), FailureCode.Stale);
    await rejectsAsync(StatusMovedException, writes.runAsync(folders, basedOn, write, null), FailureCode.Stale);

    assert.deepEqual([write.asked.length, write.ran.length, shown.length, writing.length, written.length], [0, 0, 0, 0, 0]);
  });

  test("lets the write refuse the status before anything asks or runs", async () => {
    const write = new RecordingWrite(request("asked"));
    write.refusal = new NothingStagedException();

    await rejectsAsync(NothingStagedException, writes.runAsync(folders, await basedOnAsync(), write, callOf(PermissionDecision.AllowedOnce)), FailureCode.Git, GitCode.NothingToCommit);

    assert.deepEqual([write.asked.length, write.ran.length, shown.length], [0, 0, 0]);
  });

  test("asks an agent's call the write's request, then reads the status and the request again and runs once both are unchanged", async () => {
    const write = new RecordingWrite(request("asked"));
    const basedOn = await basedOnAsync();

    await writes.runAsync(folders, basedOn, write, callOf(PermissionDecision.AllowedAlways));

    assert.deepEqual(shown, [request("asked")]);
    assert.deepEqual(write.asked.map(t => t.fingerprint), [basedOn, basedOn]);
    assert.deepEqual(write.ran.map(t => t.fingerprint), [basedOn]);
    assert.deepEqual(written, [folders.top]);
  });

  test("marks an agent's point of no return just before the write runs, whether it asked or not, and never for a write that ran nothing", async () => {
    const marked: boolean[] = [];
    for (const write of [new RecordingWrite(request("asked")), new RecordingWrite(null)]) {
      const call = callOf(PermissionDecision.AllowedOnce);
      write.onRun = () => {
        marked.push(call.hasMarkedSending);
        return Promise.resolve();
      };
      await writes.runAsync(folders, await basedOnAsync(), write, call);
    }
    const moved = new RecordingWrite(request("asked"), request("moved"));
    const call = callOf(PermissionDecision.AllowedOnce);
    await rejectsAsync(RequestMovedException, writes.runAsync(folders, await basedOnAsync(), moved, call), FailureCode.Stale);

    assert.deepEqual([...marked, call.hasMarkedSending, moved.ran.length], [true, true, false, 0]);
  });

  test("never asks an agent's call for a write that has no request", async () => {
    const write = new RecordingWrite(null);

    await writes.runAsync(folders, await basedOnAsync(), write, callOf(PermissionDecision.Denied));

    assert.equal(shown.length, 0);
    assert.equal(write.ran.length, 1);
  });

  test("runs nothing for an agent's call whose write came to need an ask while it waited, and still runs a person's", async () => {
    const basedOn = await basedOnAsync();
    const agents = new RecordingWrite(null, request("a hook was added"));
    const persons = new RecordingWrite(null, request("a hook was added"));

    await assert.rejects(writes.runAsync(folders, basedOn, agents, callOf(PermissionDecision.AllowedOnce)),
      (error: unknown) => error instanceof RequestMovedException && error.code === FailureCode.Stale && error.message.includes("What the request showed changed"));
    await writes.runAsync(folders, basedOn, persons, null);

    assert.deepEqual([shown.length, agents.asked.length, agents.ran.length, persons.ran.length], [0, 2, 0, 1]);
  });

  test("runs nothing when the person denies, doesn't answer, or the call is withdrawn", async () => {
    const basedOn = await basedOnAsync();
    const cases: IUnansweredCase[] = [
      { decision: PermissionDecision.Denied, code: FailureCode.Denied, type: RequestDeniedException },
      { decision: PermissionDecision.DeniedAlways, code: FailureCode.Denied, type: RequestDeniedException },
      { decision: PermissionDecision.Expired, code: FailureCode.Expired, type: RequestExpiredException },
      { decision: PermissionDecision.Withdrawn, code: FailureCode.Withdrawn, type: RequestWithdrawnException }
    ];
    for (const { decision, code, type } of cases) {
      const write = new RecordingWrite(request("asked"));
      await rejectsAsync(type, writes.runAsync(folders, basedOn, write, callOf(decision)), code);
      assert.equal(write.ran.length, 0, decision);
    }
    assert.equal(written.length, 0);
  });

  test("runs nothing when the repository changes while the person answers", async () => {
    const write = new RecordingWrite(request("asked"));
    const call = callOf(PermissionDecision.AllowedOnce, () => repository.writeAsync("a.txt", "changed\n"));

    await rejectsAsync(StatusMovedException, writes.runAsync(folders, await basedOnAsync(), write, call), FailureCode.Stale);

    assert.equal(write.ran.length, 0);
  });

  test("runs nothing when what the request would show changed after the person allowed it", async () => {
    const write = new RecordingWrite(request("asked"), request("changed"));

    await assert.rejects(writes.runAsync(folders, await basedOnAsync(), write, callOf(PermissionDecision.AllowedOnce)),
      (error: unknown) => error instanceof RequestMovedException && error.code === FailureCode.Stale && error.message.includes("What the request showed changed"));

    assert.equal(write.ran.length, 0);
  });

  test("tells a write cancelled or out of time after it started as OutcomeUnknown, and passes on any other failure", async () => {
    const basedOn = await basedOnAsync();
    const timedOut = new RecordingWrite();
    timedOut.failure = new ProgramTimedOutException("git", 1_000);
    await rejectsAsync(WriteOutcomeUnknownException, writes.runAsync(folders, basedOn, timedOut, null), FailureCode.Git, GitCode.OutcomeUnknown);

    const cancel = new AbortController();
    const cancelled = new RecordingWrite();
    cancelled.onRun = () => Promise.resolve(cancel.abort());
    cancelled.failure = new Error("stopped");
    await rejectsAsync(WriteOutcomeUnknownException, writes.runAsync(folders, basedOn, cancelled, null, cancel.signal), FailureCode.Git, GitCode.OutcomeUnknown);

    const failing = new RecordingWrite();
    failing.failure = new GitFailedException("add", { text: "failed\n", source: UntrustedSource.Repository });
    await rejectsAsync(GitFailedException, writes.runAsync(folders, basedOn, failing, null), FailureCode.Unavailable);

    assert.deepEqual(written, [folders.top, folders.top, folders.top]);
    assert.deepEqual(journal.read(folders.commonGitFolder).entries, []);
  });

  test("records each write it ran with the refs it moved, and an index write with the index's trees before and after", async () => {
    const before = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
    const commit = new RecordingWrite();
    commit.onRun = async () => {
      await repository.writeAsync("c.txt", "c\n");
      await repository.runGitAsync(["add", "c.txt"]);
      await repository.runGitAsync(["commit", "--quiet", "-m", "Add c"]);
    };
    await writes.runAsync(folders, await basedOnAsync(), commit, null);
    const after = (await repository.runGitAsync(["rev-parse", "HEAD"])).trim();
    const stage = new RecordingWrite();
    stage.undo = UndoMode.Index;
    stage.onRun = async () => {
      await repository.writeAsync("d.txt", "d\n");
      await repository.runGitAsync(["add", "d.txt"]);
    };
    const treeBefore = (await repository.runGitAsync(["write-tree"])).trim();
    await writes.runAsync(folders, await basedOnAsync(), stage, null);

    const [committed, staged] = journal.read(folders.commonGitFolder).entries;
    assert.deepEqual([committed?.method, committed?.branch, committed?.branchAfter, committed?.moves, committed?.undo, committed?.indexBefore],
      ["git.test", "main", "main", [new GitRefMove("refs/heads/main", before, after)], UndoMode.Refs, null]);
    assert.deepEqual([staged?.moves, staged?.undo, staged?.indexBefore, staged?.indexAfter],
      [[], UndoMode.Index, treeBefore, (await repository.runGitAsync(["write-tree"])).trim()]);
  });

  test("leaves a write out of the journal when its refs can't be read after it, and passes on any other failure of that read", async () => {
    const unreadable = new FailingAfterReader(runner);
    unreadable.failure = new GitFailedException("for-each-ref", { text: "failed\n", source: UntrustedSource.Repository });
    await new WriteRunner(statuses, unreadable, journal, () => undefined, () => undefined).runAsync(folders, await basedOnAsync(), new RecordingWrite(), null);
    assert.deepEqual(journal.read(folders.commonGitFolder).entries, []);

    const broken = new FailingAfterReader(runner);
    await assert.rejects(new WriteRunner(statuses, broken, journal, () => undefined, () => undefined).runAsync(folders, await basedOnAsync(), new RecordingWrite(), null),
      { message: "unread" });
  });
});
