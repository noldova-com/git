/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { GitFileLayout } from "../enums/git-file-layout.ts";
import { GitPathEntry } from "../models/git-path-entry.ts";
import { Resources } from "../../resources.ts";

class GitPathFolder<T> {
  public readonly folders: Map<string, GitPathFolder<T>> = new Map<string, GitPathFolder<T>>();
  public readonly items: T[] = [];
}

export class GitPathLayout {
  public static layout<T>(items: readonly T[], pathOf: (item: T) => string, layout: GitFileLayout, closed: ReadonlySet<string>): GitPathEntry<T>[] {
    switch (layout) {
      case GitFileLayout.List:
        return items.map(t => new GitPathEntry("", pathOf(t), 0, t));
      case GitFileLayout.Folders:
        return GitPathLayout.foldersOf(items, pathOf, closed);
      default: {
        const root: GitPathFolder<T> = new GitPathFolder<T>();
        for (const item of items) {
          const names: readonly string[] = pathOf(item).split(Resources.slash);
          let folder: GitPathFolder<T> = root;
          for (const name of names.slice(0, -1)) {
            const next: GitPathFolder<T> = folder.folders.get(name) ?? new GitPathFolder<T>();
            folder.folders.set(name, next);
            folder = next;
          }
          folder.items.push(item);
        }
        const entries: GitPathEntry<T>[] = [];
        GitPathLayout.addTree(entries, root, "", 0, pathOf, closed);
        return entries;
      }
    }
  }

  private static foldersOf<T>(items: readonly T[], pathOf: (item: T) => string, closed: ReadonlySet<string>): GitPathEntry<T>[] {
    const folders: Map<string, T[]> = new Map<string, T[]>();
    for (const item of items) {
      const path: string = pathOf(item);
      const folder: string = path.slice(0, Math.max(path.lastIndexOf(Resources.slash), 0));
      folders.set(folder, [...folders.get(folder) ?? [], item]);
    }
    const entries: GitPathEntry<T>[] = [];
    for (const [folder, inFolder] of [...folders].sort(([a], [b]) => Number(a === "") - Number(b === "") || GitPathLayout.compare(a, b))) {
      const nested: boolean = folder !== "";
      if (nested)
        entries.push(new GitPathEntry<T>(folder, folder, 0, null));
      if (!nested || !closed.has(folder))
        entries.push(...inFolder.map(t => new GitPathEntry("", nested ? pathOf(t).slice(folder.length + 1) : pathOf(t), Number(nested), t)));
    }
    return entries;
  }

  private static addTree<T>(entries: GitPathEntry<T>[], folder: GitPathFolder<T>, path: string, depth: number, pathOf: (item: T) => string,
    closed: ReadonlySet<string>): void {
    for (const [first, child] of [...folder.folders].sort(([a], [b]) => GitPathLayout.compare(a, b))) {
      let name: string = first;
      let shown: GitPathFolder<T> = child;
      while (shown.items.length === 0 && shown.folders.size === 1)
        for (const [next, inner] of shown.folders) {
          name = `${name}${Resources.slash}${next}`;
          shown = inner;
        }
      const whole: string = path === "" ? name : `${path}${Resources.slash}${name}`;
      entries.push(new GitPathEntry<T>(whole, name, depth, null));
      if (!closed.has(whole))
        GitPathLayout.addTree(entries, shown, whole, depth + 1, pathOf, closed);
    }
    entries.push(...folder.items.map(t => new GitPathEntry("", pathOf(t).slice(path === "" ? 0 : path.length + 1), depth, t)));
  }

  private static compare(a: string, b: string): number {
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  }
}
