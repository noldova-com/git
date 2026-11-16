/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SQLOutputValue } from "node:sqlite";

import { type IModuleDatabase, Migration } from "@noldova/desktop.runtime";
import { WorktreeRecord } from "@noldova/git.protocol";

import { WorktreeState } from "../enums/worktree-state.ts";
import { ColumnInvalidException } from "../exceptions/column-invalid.exception.ts";
import { StoredWorktree } from "../models/stored-worktree.ts";
import { Resources } from "../resources.ts";

export class WorktreeTable {
  public static readonly migration: Migration = new Migration(Resources.worktreesMigrationId, [Resources.createWorktreesTable]);

  private readonly database: Pick<IModuleDatabase, "read" | "readAll" | "run">;

  public constructor(database: Pick<IModuleDatabase, "read" | "readAll" | "run">) {
    this.database = database;
  }

  public find(key: string): StoredWorktree | null {
    const row = this.database.read(Resources.selectWorktree, key);
    return row === undefined ? null : this.toStored(row);
  }

  public readAll(): StoredWorktree[] {
    return this.database.readAll(Resources.selectWorktrees).map(t => this.toStored(t));
  }

  public insertPending(record: WorktreeRecord): void {
    this.database.run(Resources.insertWorktree, record.key, record.repository, record.path, record.branch, record.base, WorktreeState.Pending);
  }

  public markReady(key: string): void {
    this.database.run(Resources.markWorktree, WorktreeState.Ready, key);
  }

  public delete(key: string): void {
    this.database.run(Resources.deleteWorktree, key);
  }

  private toStored(row: Record<string, SQLOutputValue>): StoredWorktree {
    const record = new WorktreeRecord(
      this.readText(row, Resources.keyColumn),
      this.readText(row, Resources.repositoryColumn),
      this.readText(row, Resources.pathColumn),
      this.readText(row, Resources.branchColumn),
      this.readText(row, Resources.baseColumn));
    return new StoredWorktree(record, this.readState(row));
  }

  private readState(row: Record<string, SQLOutputValue>): WorktreeState {
    const state = this.readText(row, Resources.stateColumn);
    if (state === WorktreeState.Pending)
      return WorktreeState.Pending;
    if (state === WorktreeState.Ready)
      return WorktreeState.Ready;
    throw new ColumnInvalidException(Resources.stateColumn);
  }

  private readText(row: Record<string, SQLOutputValue>, column: string): string {
    const value = row[column];
    if (typeof value !== "string")
      throw new ColumnInvalidException(column);
    return value;
  }
}
