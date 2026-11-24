/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";

import type { GitResolvedBy } from "../enums/git-resolved-by.ts";

/** What the conflict screen shares with the Git panel: the file a folder's panel asked it to open, and how each file was resolved while the operation runs. */
export class GitResolving {
  public static readonly opened: WritableSignal<ReadonlyMap<string, string>> = signal<ReadonlyMap<string, string>>(new Map());
  public static readonly resolutions: WritableSignal<ReadonlyMap<string, ReadonlyMap<string, GitResolvedBy>>> =
    signal<ReadonlyMap<string, ReadonlyMap<string, GitResolvedBy>>>(new Map());

  /** Asks a folder's conflict screen to show a conflicted file. */
  public static open(folder: string, path: string): void {
    GitResolving.opened.update(t => new Map([...t, [folder, path]]));
  }

  /** The file a folder's panel last asked to open, or `null`. */
  public static pathOf(folder: string): string | null {
    return GitResolving.opened().get(folder) ?? null;
  }

  /** Notes which choice resolved a folder's file, such as both sides, which the write itself doesn't name. */
  public static record(folder: string, path: string, by: GitResolvedBy): void {
    GitResolving.resolutions.update(t => new Map([...t, [folder, new Map([...t.get(folder) ?? [], [path, by]])]]));
  }

  /** How each of a folder's files was resolved since its operation began. */
  public static resolutionsOf(folder: string): ReadonlyMap<string, GitResolvedBy> {
    return GitResolving.resolutions().get(folder) ?? new Map<string, GitResolvedBy>();
  }

  /** Drops a folder's resolutions once its operation ends, so the next one starts with none. */
  public static forget(folder: string): void {
    if (!GitResolving.resolutions().has(folder))
      return;
    GitResolving.resolutions.update(t => new Map([...t].filter(([key]) => key !== folder)));
  }
}
