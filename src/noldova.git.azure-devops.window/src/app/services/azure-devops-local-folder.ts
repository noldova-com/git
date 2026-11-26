/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IWindowPartContext, WindowException } from "@noldova/desktop.window";
import { GitFolderParams, GitNames, type GitRemote, GitStatus } from "@noldova/git.protocol";
import { GitFolder } from "@noldova/git.window";

import { WorkItemsPlace } from "../models/work-items-place.ts";
import { Resources } from "../../resources.ts";

export class AzureDevOpsLocalFolder {
  public static async readAsync(context: IWindowPartContext, pullRequestUrl: string): Promise<string | null> {
    const folder: string | null = GitFolder.folder();
    const repository: string | null = AzureDevOpsLocalFolder.pageRepositoryOf(pullRequestUrl);
    if (Object.isNull(folder) || Object.isNull(repository))
      return null;
    try {
      const status: GitStatus = GitStatus.fromJson(await context.requestAsync(GitNames.statusMethod, new GitFolderParams(folder).toJson()));
      return AzureDevOpsLocalFolder.remoteRepositoryOf(status.remote) === repository ? folder : null;
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      context.log(Resources.formatRequestFailed(GitNames.statusMethod, String(error)));
      return null;
    }
  }

  private static pageRepositoryOf(url: string): string | null {
    const found: RegExpExecArray | null = Resources.pullRequestPageRepositoryPattern.exec(url);
    return Object.isNull(found) ? null : AzureDevOpsLocalFolder.keyOf(found.slice(1));
  }

  private static remoteRepositoryOf(remote: GitRemote | null): string | null {
    const place: WorkItemsPlace | null = WorkItemsPlace.ofRemote(remote);
    const path: string = remote?.path ?? "";
    return Object.isNull(place) ? null : AzureDevOpsLocalFolder.keyOf([place.organization, encodeURIComponent(place.project), path.slice(path.lastIndexOf("/") + 1)]);
  }

  private static keyOf(parts: readonly string[]): string | null {
    try {
      return parts.map(t => decodeURIComponent(t).toLowerCase()).join("/");
    }
    catch {
      return null;
    }
  }
}
