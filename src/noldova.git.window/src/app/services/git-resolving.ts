/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";

import type { GitResolvedBy } from "../enums/git-resolved-by.ts";

export class GitResolving {
  public static readonly opened: WritableSignal<ReadonlyMap<string, string>> = signal<ReadonlyMap<string, string>>(new Map());
  public static readonly resolutions: WritableSignal<ReadonlyMap<string, ReadonlyMap<string, GitResolvedBy>>> =
    signal<ReadonlyMap<string, ReadonlyMap<string, GitResolvedBy>>>(new Map());

  public static open(folder: string, path: string): void {
    GitResolving.opened.update(t => new Map([...t, [folder, path]]));
  }

  public static pathOf(folder: string): string | null {
    return GitResolving.opened().get(folder) ?? null;
  }

  public static record(folder: string, path: string, by: GitResolvedBy): void {
    GitResolving.resolutions.update(t => new Map([...t, [folder, new Map([...t.get(folder) ?? [], [path, by]])]]));
  }

  public static resolutionsOf(folder: string): ReadonlyMap<string, GitResolvedBy> {
    return GitResolving.resolutions().get(folder) ?? new Map<string, GitResolvedBy>();
  }

  public static forget(folder: string): void {
    if (!GitResolving.resolutions().has(folder))
      return;
    GitResolving.resolutions.update(t => new Map([...t].filter(([key]) => key !== folder)));
  }
}
