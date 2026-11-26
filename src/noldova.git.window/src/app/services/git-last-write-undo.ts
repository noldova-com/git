/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import { createWatch, untracked, type Watch } from "@angular/core/primitives/signals";
import "@noldova/context.core";
import { type IWindowPartContext, WindowException } from "@noldova/desktop.window";
import { type GitJournal, type GitJournalEntry, type GitStatus, UndoMode } from "@noldova/git.protocol";

import { GitLastWrite } from "../models/git-last-write.ts";
import { Resources } from "../../resources.ts";
import { GitFolder } from "./git-folder.ts";
import { GitRuntimeClient } from "./git-runtime-client.ts";

export class GitLastWriteUndo {
  private readonly context: IWindowPartContext;
  private readonly client: GitRuntimeClient;
  private readonly last: WritableSignal<GitLastWrite | null> = signal<GitLastWrite | null>(null);
  private folder: string | null = null;
  private reads: number = 0;

  private constructor(context: IWindowPartContext) {
    this.context = context;
    this.client = new GitRuntimeClient(context);
  }

  public static provide(context: IWindowPartContext): () => void {
    const undo = new GitLastWriteUndo(context);
    let withdraw: () => void;
    try {
      withdraw = context.provideUndo({ canUndo: () => !Object.isNull(undo.last()), undoAsync: () => undo.undoAsync() });
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      context.log(Resources.undoTaken);
      return () => undefined;
    }
    const unlisten: () => void = undo.client.onChanged(folder => {
      if (folder === undo.folder)
        void undo.readAsync(folder);
    });
    const watch: Watch = createWatch(() => {
      const folder: string | null = GitFolder.folder();
      untracked(() => undo.change(folder));
    }, t => queueMicrotask(() => t.run()), false);
    watch.run();
    return () => {
      watch.destroy();
      unlisten();
      withdraw();
      undo.change(null);
    };
  }

  private change(folder: string | null): void {
    if (folder === this.folder)
      return;
    this.folder = folder;
    this.reads++;
    this.last.set(null);
    if (!Object.isNull(folder))
      void this.readAsync(folder);
  }

  private async undoAsync(): Promise<void> {
    const last: GitLastWrite | null = this.last();
    if (Object.isNull(last))
      return;
    this.reads++;
    this.last.set(null);
    try {
      await this.client.undoAsync(last.folder, last.id, last.fingerprint);
    }
    finally {
      if (last.folder === this.folder)
        void this.readAsync(last.folder);
    }
  }

  private async readAsync(folder: string): Promise<void> {
    const read: number = ++this.reads;
    try {
      const statusRead: Promise<GitStatus> = this.client.statusAsync(folder);
      const journalRead: Promise<GitJournal> = this.client.journalAsync(folder);
      await Promise.all([statusRead, journalRead]);
      const status: GitStatus = await statusRead;
      const entry: GitJournalEntry | undefined = (await journalRead).entries.at(-1);
      if (read === this.reads)
        this.last.set(Object.isUndefined(entry) || entry.undo === UndoMode.None ? null : new GitLastWrite(folder, entry.id, status.fingerprint));
    }
    catch (error) {
      if (read !== this.reads)
        return;
      this.last.set(null);
      if (!GitRuntimeClient.isFailure(error))
        this.context.log(Resources.formatUndoReadFailed(folder, String(error)));
    }
  }
}
