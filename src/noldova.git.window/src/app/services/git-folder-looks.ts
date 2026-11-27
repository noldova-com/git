/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRepositoryScan } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { GitFolderLook } from "../models/git-folder-look.ts";
import { GitRepositoryScans } from "./git-repository-scans.ts";
import type { GitRuntimeClient } from "./git-runtime-client.ts";

export class GitFolderLooks {
  private static readonly looks: Map<string, GitFolderLook> = new Map();

  public static join(folder: string, client: GitRuntimeClient, offer: (scan: GitRepositoryScan) => void, report: (error: unknown) => void): GitFolderLook {
    let look: GitFolderLook | undefined = GitFolderLooks.looks.get(folder);
    if (Object.isUndefined(look)) {
      look = new GitFolderLook(folder);
      GitFolderLooks.looks.set(folder, look);
      void GitFolderLooks.lookAsync(look, client, report);
    }
    look.offers.add(offer);
    return look;
  }

  public static leave(look: GitFolderLook, offer: (scan: GitRepositoryScan) => void): void {
    look.offers.delete(offer);
    if (look.offers.size === 0)
      GitFolderLooks.looks.delete(look.folder);
  }

  private static async lookAsync(look: GitFolderLook, client: GitRuntimeClient, report: (error: unknown) => void): Promise<void> {
    let scan: GitRepositoryScan;
    try {
      scan = await client.scanRepositoriesAsync(look.folder);
    }
    catch (error) {
      report(error);
      look.text.set(Resources.formatScanFailedBelow(look.folder));
      return;
    }
    look.text.set(GitRepositoryScans.belowTextOf(look.folder, scan));
    const offer: ((scan: GitRepositoryScan) => void) | undefined = [...look.offers].at(-1);
    if (scan.repositories.length > 0 && !Object.isUndefined(offer))
      offer(scan);
  }
}
