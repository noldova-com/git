/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import type { GitRemote } from "@noldova/git.protocol";

import type { IGitPullRequests } from "../interfaces/i-git-pull-requests.ts";
import type { GitRefChip } from "../models/git-ref-chip.ts";
import { Resources } from "../../resources.ts";
import { GitProvidedPullRequests } from "../models/git-provided-pull-requests.ts";

export class GitPullRequests {
  private static readonly provided: WritableSignal<readonly GitProvidedPullRequests[]> = signal<readonly GitProvidedPullRequests[]>([]);

  public static provide(context: IWindowPartContext, pullRequests: IGitPullRequests): () => void {
    const provided: GitProvidedPullRequests = new GitProvidedPullRequests(context, pullRequests);
    GitPullRequests.provided.update(t => [...t, provided]);
    return () => GitPullRequests.provided.update(t => t.filter(u => u !== provided));
  }

  public static of(remote: GitRemote): IGitPullRequests | null {
    for (const { context, pullRequests } of GitPullRequests.provided())
      try {
        if (pullRequests.claims(remote))
          return pullRequests;
      }
      catch (error) {
        context.log(Resources.formatPullRequestsClaimFailed(String(error)));
      }
    return null;
  }

  public static newPullRequestUrlOf(remote: GitRemote | null, source: GitRefChip, labels: readonly GitRefChip[], target: GitRefChip): string | null {
    if (Object.isNull(remote))
      return null;
    const host: IGitPullRequests | null = GitPullRequests.of(remote);
    const newPullRequestUrl: IGitPullRequests["newPullRequestUrl"] = host?.newPullRequestUrl;
    const sourceName: string | null = source.branchOn(remote.name, labels);
    const targetName: string | null = target.baseOn(remote.name);
    if (Object.isNull(host) || Object.isUndefined(newPullRequestUrl) || Object.isNull(sourceName) || Object.isNull(targetName))
      return null;
    return newPullRequestUrl.call(host, remote, sourceName, targetName);
  }
}
