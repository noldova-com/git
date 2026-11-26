/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";
import { JsonReader } from "@noldova/context.json";

import { GitWorkspace } from "../models/git-workspace.ts";
import { GitWindowStorage } from "./git-window-storage.ts";

export class GitWorkspaces {
  private static readonly KEY: string = "git.workspaces";
  private static readonly workspaces: WritableSignal<readonly GitWorkspace[]> = signal<readonly GitWorkspace[]>([]);

  public static readonly list: Signal<readonly GitWorkspace[]> = GitWorkspaces.workspaces.asReadonly();

  public static restore(): void {
    const list: GitWorkspace[] = [];
    for (const value of GitWindowStorage.readArray(GitWorkspaces.KEY))
      try {
        list.push(GitWorkspace.fromJson(JsonReader.fromValue(value)));
      }
      catch {
      }
    GitWorkspaces.workspaces.set(list);
  }

  public static find(id: string): GitWorkspace | null {
    return GitWorkspaces.workspaces().find(t => t.id === id) ?? null;
  }

  public static create(name: string): GitWorkspace {
    const workspace: GitWorkspace = new GitWorkspace(crypto.randomUUID(), name, []);
    GitWorkspaces.save([...GitWorkspaces.workspaces(), workspace]);
    return workspace;
  }

  public static remove(id: string): void {
    GitWorkspaces.save(GitWorkspaces.workspaces().filter(t => t.id !== id));
  }

  public static rename(id: string, name: string): void {
    GitWorkspaces.change(id, t => t.withName(name));
  }

  public static addFolder(id: string, folder: string): void {
    GitWorkspaces.change(id, t => t.withFolder(folder));
  }

  public static removeFolders(id: string, folders: ReadonlySet<string>): void {
    GitWorkspaces.change(id, t => t.withoutFolders(folders));
  }

  public static moveFolders(id: string, folders: ReadonlySet<string>, by: -1 | 1): void {
    GitWorkspaces.change(id, t => t.withFoldersMoved(folders, by));
  }

  private static change(id: string, change: (workspace: GitWorkspace) => GitWorkspace): void {
    GitWorkspaces.save(GitWorkspaces.workspaces().map(t => t.id === id ? change(t) : t));
  }

  private static save(list: readonly GitWorkspace[]): void {
    GitWorkspaces.workspaces.set(list);
    GitWindowStorage.write(GitWorkspaces.KEY, list.map(t => t.toJson()));
  }
}
