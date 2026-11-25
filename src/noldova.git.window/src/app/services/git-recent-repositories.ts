/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";

import { Resources } from "../../resources.ts";
import { GitWindowStorage } from "./git-window-storage.ts";

/**
 * The repositories opened lately, newest first, kept in the window's storage: a setting can't hold a list of folders, and each setting
 * shows on a settings page.
 */
export class GitRecentRepositories {
  private static readonly KEY: string = "git.recentRepositories";
  private static readonly LIMIT: number = 20;
  private static readonly folders: WritableSignal<readonly string[]> = signal<readonly string[]>([]);

  public static readonly recent: Signal<readonly string[]> = GitRecentRepositories.folders.asReadonly();

  /** Reads the list kept in the window's storage again, keeping only its folders. */
  public static restore(): void {
    GitRecentRepositories.folders.set(GitWindowStorage.readArray(GitRecentRepositories.KEY).filter(t => Object.isString(t)));
  }

  /** Puts a folder first, and drops the oldest past twenty. */
  public static remember(folder: string): void {
    GitRecentRepositories.save([folder, ...GitRecentRepositories.folders().filter(t => t !== folder)].slice(0, GitRecentRepositories.LIMIT));
  }

  public static forget(folders: ReadonlySet<string>): void {
    GitRecentRepositories.save(GitRecentRepositories.folders().filter(t => !folders.has(t)));
  }

  /** A folder's last name, which a list shows for its repository. */
  public static nameOf(folder: string): string {
    return Resources.formatHistoryTitle(folder);
  }

  private static save(folders: readonly string[]): void {
    GitRecentRepositories.folders.set(folders);
    GitWindowStorage.write(GitRecentRepositories.KEY, [...folders]);
  }
}
