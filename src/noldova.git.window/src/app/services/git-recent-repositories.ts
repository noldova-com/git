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

export class GitRecentRepositories {
  private static readonly KEY: string = "git.recentRepositories";
  private static readonly LIMIT: number = 20;
  private static readonly folders: WritableSignal<readonly string[]> = signal<readonly string[]>([]);

  public static readonly recent: Signal<readonly string[]> = GitRecentRepositories.folders.asReadonly();

  public static restore(): void {
    GitRecentRepositories.folders.set(GitWindowStorage.readArray(GitRecentRepositories.KEY).filter(t => Object.isString(t)));
  }

  public static remember(folder: string): void {
    GitRecentRepositories.save([folder, ...GitRecentRepositories.folders().filter(t => t !== folder)].slice(0, GitRecentRepositories.LIMIT));
  }

  public static forget(folders: ReadonlySet<string>): void {
    GitRecentRepositories.save(GitRecentRepositories.folders().filter(t => !folders.has(t)));
  }

  public static nameOf(folder: string): string {
    return Resources.formatHistoryTitle(folder);
  }

  private static save(folders: readonly string[]): void {
    GitRecentRepositories.folders.set(folders);
    GitWindowStorage.write(GitRecentRepositories.KEY, [...folders]);
  }
}
