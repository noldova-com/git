/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { isDeepStrictEqual } from "node:util";

import { type IPermissionRequest, PermissionDecision, type PermissionOutcome } from "@noldova/desktop.runtime";
import { FailureCode, type GitStatus, UndoMode } from "@noldova/git.protocol";

import { GitFailureException } from "../exceptions/git-failure.exception.ts";
import { RequestDeniedException } from "../exceptions/request-denied.exception.ts";
import { RequestExpiredException } from "../exceptions/request-expired.exception.ts";
import { RequestMovedException } from "../exceptions/request-moved.exception.ts";
import { RequestWithdrawnException } from "../exceptions/request-withdrawn.exception.ts";
import { StatusMovedException } from "../exceptions/status-moved.exception.ts";
import { WriteOutcomeUnknownException } from "../exceptions/write-outcome-unknown.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import type { IWriteCall } from "../interfaces/i-write-call.ts";
import type { RefSnapshot } from "../models/ref-snapshot.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import type { Journal } from "./journal.ts";
import type { RefSnapshotReader } from "./ref-snapshot.reader.ts";
import type { StatusReader } from "./status.reader.ts";
import { WriteQueue } from "./write-queue.ts";

export class WriteRunner {
  private readonly statuses: StatusReader;
  private readonly onWriting: (top: string) => void;
  private readonly onWritten: (top: string) => void;
  private readonly snapshots: RefSnapshotReader;
  private readonly journal: Journal;
  private readonly queue: WriteQueue = new WriteQueue();

  public constructor(statuses: StatusReader, snapshots: RefSnapshotReader, journal: Journal, onWriting: (top: string) => void, onWritten: (top: string) => void) {
    this.statuses = statuses;
    this.snapshots = snapshots;
    this.journal = journal;
    this.onWriting = onWriting;
    this.onWritten = onWritten;
  }

  public async runAsync(folders: RepositoryFolders, basedOn: string, write: IGitWrite, call: IWriteCall | null, signal?: AbortSignal): Promise<void> {
    const asked = call === null ? null : { call, request: await this.askAsync(folders, basedOn, write, call, signal) };
    await this.queue.runAsync(folders.commonGitFolder, async () => {
      const status = await this.readAsync(folders, basedOn, write, signal);
      if (asked !== null && !isDeepStrictEqual(await write.requestAsync(folders, status, asked.call, signal), asked.request))
        throw new RequestMovedException();
      const before = await this.snapshots.readAsync(folders, write.undo === UndoMode.Index, signal);
      call?.markSending();
      this.onWriting(folders.top);
      try {
        await write.runAsync(folders, status, signal);
        await this.recordAsync(folders, write, before, signal);
      } catch (error) {
        if (signal?.aborted === true || (error instanceof GitFailureException && error.code === FailureCode.TimedOut))
          throw new WriteOutcomeUnknownException(error);
        throw error;
      } finally {
        this.onWritten(folders.top);
      }
    });
  }

  /** Records the write in the journal; a write that succeeded but whose refs can't be read again is left out, so it can't be undone. */
  private async recordAsync(folders: RepositoryFolders, write: IGitWrite, before: RefSnapshot, signal?: AbortSignal): Promise<void> {
    let after: RefSnapshot;
    try {
      after = await this.snapshots.readAsync(folders, write.undo === UndoMode.Index, signal);
    } catch (error) {
      if (!(error instanceof GitFailureException))
        throw error;
      return;
    }
    this.journal.record(folders.commonGitFolder, folders.gitFolder, write.method, write.undo, before, after, write.checkpoint ?? null);
  }

  private async askAsync(
    folders: RepositoryFolders,
    basedOn: string,
    write: IGitWrite,
    call: IWriteCall,
    signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const request = await write.requestAsync(folders, await this.readAsync(folders, basedOn, write, signal), call, signal);
    if (request !== null)
      WriteRunner.requireAllowed(await call.requestPermissionAsync(request));
    return request;
  }

  private async readAsync(folders: RepositoryFolders, basedOn: string, write: IGitWrite, signal?: AbortSignal): Promise<GitStatus> {
    const status = await this.statuses.readAsync(folders, signal);
    if (status.fingerprint !== basedOn)
      throw new StatusMovedException();
    write.refuse(status);
    return status;
  }

  private static requireAllowed(outcome: PermissionOutcome): void {
    if (outcome.isAllowed)
      return;
    if (outcome.decision === PermissionDecision.Expired)
      throw new RequestExpiredException();
    if (outcome.decision === PermissionDecision.Withdrawn)
      throw new RequestWithdrawnException();
    throw new RequestDeniedException();
  }
}
