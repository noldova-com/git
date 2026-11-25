/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createWatch, untracked, type Watch } from "@angular/core/primitives/signals";
import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import type { GitCommandLog, GitStatus } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { GitFolder } from "./git-folder.ts";
import { GitRuntimeClient } from "./git-runtime-client.ts";
import { GitStatusBar } from "./git-status-bar.ts";

/**
 * Keeps the status bar on the open repository whatever the window shows: it follows the folder Git shows, watches it while it is open, and reads its status and
 * its writes' last command again after each change, so no view or tab has to be open for the branch, its fetch and its last command to show.
 */
export class GitStatusFollower {
  private readonly context: IWindowPartContext;
  private readonly client: GitRuntimeClient;
  private folder: string | null = null;
  private reads: number = 0;

  private constructor(context: IWindowPartContext) {
    this.context = context;
    this.client = new GitRuntimeClient(context);
  }

  /** Starts following the folder Git shows; the returned function stops, lets the folder go and hides the items. */
  public static follow(context: IWindowPartContext): () => void {
    const follower = new GitStatusFollower(context);
    const unlisten: () => void = follower.client.onChanged(folder => {
      if (folder === follower.folder)
        void follower.readAsync(folder);
    });
    const watch: Watch = createWatch(() => {
      const folder: string | null = GitFolder.folder();
      untracked(() => follower.change(folder));
    }, t => queueMicrotask(() => t.run()), false);
    watch.run();
    return () => {
      watch.destroy();
      unlisten();
      follower.change(null);
    };
  }

  private change(folder: string | null): void {
    if (folder === this.folder)
      return;
    const previous: string | null = this.folder;
    this.folder = folder;
    this.reads++;
    GitStatusBar.show(null, null);
    GitStatusBar.showCommand(null, null);
    if (!Object.isNull(previous))
      void this.client.unwatchAsync(previous).catch((error: unknown) => this.context.log(Resources.formatStatusBarUnwatchFailed(previous, String(error))));
    if (Object.isNull(folder))
      return;
    void this.client.watchAsync(folder).catch((error: unknown) => this.context.log(Resources.formatStatusBarWatchFailed(folder, String(error))));
    void this.readAsync(folder);
  }

  /** Reads the folder's status and last command and shows them; a later read wins over an earlier one still running, and one Git can't answer hides the items. */
  private async readAsync(folder: string): Promise<void> {
    const read: number = ++this.reads;
    try {
      const [status, log]: readonly [GitStatus, GitCommandLog] = await Promise.all([this.client.statusAsync(folder), this.client.commandLogAsync(folder)]);
      if (read !== this.reads)
        return;
      GitStatusBar.show(folder, status);
      GitStatusBar.showCommand(folder, log.commands.at(-1) ?? null);
    }
    catch (error) {
      if (read !== this.reads)
        return;
      GitStatusBar.show(null, null);
      GitStatusBar.showCommand(null, null);
      if (!GitRuntimeClient.isFailure(error))
        this.context.log(Resources.formatStatusBarReadFailed(folder, String(error)));
    }
  }
}
