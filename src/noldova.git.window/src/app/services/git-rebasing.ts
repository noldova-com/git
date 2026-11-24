/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { GitWindowStorage } from "./git-window-storage.ts";

/** The commit a folder's rebase screen rebases onto: its id, and the name it shows for it, a branch on it or its short id. */
export class GitRebaseTarget {
  public readonly id: string;
  public readonly name: string;

  public constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}

/**
 * What a commit's detail hands the rebase screen it opens: the commit each folder's screen rebases onto, kept in the window's storage so
 * a rebase screen the window restores after a restart still has its plan.
 */
export class GitRebasing {
  private static readonly KEY: string = "git.rebaseTargets";

  public static readonly targets: WritableSignal<ReadonlyMap<string, GitRebaseTarget>> = signal<ReadonlyMap<string, GitRebaseTarget>>(new Map());

  /** Reads the targets kept in the window's storage again; a target that no longer reads is dropped, and the others stay. */
  public static restore(): void {
    const targets: Map<string, GitRebaseTarget> = new Map();
    for (const value of GitWindowStorage.readArray(GitRebasing.KEY))
      try {
        const reader: JsonReader = JsonReader.fromValue(value);
        targets.set(reader.readNonBlankString("folder"), new GitRebaseTarget(reader.readNonBlankString("id"), reader.readNonBlankString("name")));
      }
      catch {
        // A target that no longer reads is dropped; the others stay.
      }
    GitRebasing.targets.set(targets);
  }

  public static open(folder: string, target: GitRebaseTarget): void {
    GitRebasing.save(new Map([...GitRebasing.targets(), [folder, target]]));
  }

  /** The commit a folder's screen rebases onto, or `null` once the screen was closed or before one was opened. */
  public static targetOf(folder: string): GitRebaseTarget | null {
    return GitRebasing.targets().get(folder) ?? null;
  }

  public static forget(folder: string): void {
    GitRebasing.save(new Map([...GitRebasing.targets()].filter(([key]) => key !== folder)));
  }

  private static save(targets: ReadonlyMap<string, GitRebaseTarget>): void {
    GitRebasing.targets.set(targets);
    GitWindowStorage.write(GitRebasing.KEY, [...targets].map(([folder, target]): JsonObject => ({ folder, id: target.id, name: target.name })));
  }
}
