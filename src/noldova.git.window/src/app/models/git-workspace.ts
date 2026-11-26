/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { GitMovingFolder } from "./git-moving-folder.ts";

export class GitWorkspace {
  public readonly id: string;
  public readonly name: string;
  public readonly folders: readonly string[];

  public constructor(id: string, name: string, folders: readonly string[]) {
    this.id = id;
    this.name = name;
    this.folders = folders;
  }

  public static fromJson(reader: JsonReader): GitWorkspace {
    return new GitWorkspace(reader.readNonBlankString("id"), reader.readNonBlankString("name"), [...new Set(reader.readStringArray("folders"))]);
  }

  public withName(name: string): GitWorkspace {
    return new GitWorkspace(this.id, name, this.folders);
  }

  public withFolder(folder: string): GitWorkspace {
    return this.folders.includes(folder) ? this : new GitWorkspace(this.id, this.name, [...this.folders, folder]);
  }

  public withoutFolders(folders: ReadonlySet<string>): GitWorkspace {
    return new GitWorkspace(this.id, this.name, this.folders.filter(t => !folders.has(t)));
  }

  public withFoldersMoved(folders: ReadonlySet<string>, by: -1 | 1): GitWorkspace {
    const order: string[] = [...this.folders];
    const moving: GitMovingFolder[] = this.folders.flatMap((folder, index) => folders.has(folder) ? [new GitMovingFolder(folder, index)] : []);
    for (const { folder, index } of by < 0 ? moving : moving.reverse()) {
      const neighbor: string | undefined = order[index + by];
      if (!Object.isUndefined(neighbor) && !folders.has(neighbor)) {
        order[index + by] = folder;
        order[index] = neighbor;
      }
    }
    return new GitWorkspace(this.id, this.name, order);
  }

  public toJson(): JsonObject {
    return { id: this.id, name: this.name, folders: [...this.folders] };
  }
}
