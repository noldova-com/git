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

/** The pull request lists host modules give the repository panel, with the context each was given by, asked in the order they were given. */
export class GitPullRequests {
  private static readonly provided: WritableSignal<readonly (readonly [IWindowPartContext, IGitPullRequests])[]> = signal([]);

  public static provide(context: IWindowPartContext, pullRequests: IGitPullRequests): () => void {
    const provided = [context, pullRequests] as const;
    GitPullRequests.provided.update(t => [...t, provided]);
    return () => GitPullRequests.provided.update(t => t.filter(u => u !== provided));
  }

  /** The first host that claims the remote, logging to its own part a host whose claim throws and passing over it. */
  public static of(remote: GitRemote): IGitPullRequests | null {
    for (const [context, pullRequests] of GitPullRequests.provided())
      try {
        if (pullRequests.claims(remote))
          return pullRequests;
      }
      catch (error) {
        context.log(Resources.formatPullRequestsClaimFailed(String(error)));
      }
    return null;
  }

  /**
   * The page of the host that claims the remote for a new pull request of the dropped branch, among its commit's `labels`, into the label it was
   * dropped on, both named as the remote names them; `null` without a remote, a host that claims it and offers one, or the dropped branch on the
   * remote at its commit, or for a remote branch of another remote.
   */
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
