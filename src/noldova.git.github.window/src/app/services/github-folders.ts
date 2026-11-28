/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IWindowPartContext, WindowException } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { FolderQuery } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";

export class GitHubFolders {
  private static readonly uses: WeakMap<IWindowPartContext, Map<string, Promise<void>>> = new WeakMap();

  public static useAsync(context: IWindowPartContext, folder: string, remote: GitRemote): Promise<void> {
    let uses: Map<string, Promise<void>> | undefined = GitHubFolders.uses.get(context);
    if (Object.isUndefined(uses)) {
      uses = new Map();
      GitHubFolders.uses.set(context, uses);
    }
    const key: string = JSON.stringify([folder, remote.name, remote.host, remote.path]);
    const known: Promise<void> | undefined = uses.get(key);
    if (!Object.isUndefined(known))
      return known;
    const use: Promise<void> = GitHubFolders.sendAsync(context, uses, key, new FolderQuery(folder, remote.name));
    uses.set(key, use);
    return use;
  }

  public static forget(context: IWindowPartContext): void {
    GitHubFolders.uses.delete(context);
  }

  private static async sendAsync(context: IWindowPartContext, uses: Map<string, Promise<void>>, key: string, query: FolderQuery): Promise<void> {
    try {
      await context.requestAsync(GitHubNames.useFolderMethod, query.toJson());
    }
    catch (error) {
      uses.delete(key);
      if (!(error instanceof WindowException))
        throw error;
      context.log(Resources.formatRequestFailed(GitHubNames.useFolderMethod, String(error)));
    }
  }
}
