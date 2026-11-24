/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRemote, GitStatus } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { WorkItemsPlace } from "./work-items-place.ts";

/** Whether a local clone's remote is the repository of an Azure DevOps pull request page. */
export class PullRequestClone {
  /** Whether `remote` names the organization, project and repository of the pull request at `url`, ignoring case as Azure DevOps does. */
  public static isCloneOf(remote: GitRemote | null, url: string): boolean {
    const page = Resources.pullRequestAddressPattern.exec(url);
    const place: WorkItemsPlace | null = WorkItemsPlace.ofRemote(remote);
    const repository: string | null = PullRequestClone.repositoryOf(remote);
    if (page === null || place === null || repository === null)
      return false;
    return PullRequestClone.isSame(page[1], place.organization) && PullRequestClone.isSame(WorkItemsPlace.decode(page[2]), place.project)
      && PullRequestClone.isSame(WorkItemsPlace.decode(page[3]), repository);
  }

  /** The repository's decoded name in an Azure DevOps remote's path, or `null` when the path names none. */
  public static repositoryOf(remote: GitRemote | null): string | null {
    return WorkItemsPlace.decode(PullRequestClone.patternOf(remote?.host ?? null).exec(remote?.path ?? "")?.[1]);
  }

  /**
   * Whether `status` is a clone of the pull request at `url` on `branch`, with that branch on the same remote as its upstream, so `git.pull` brings
   * in what the pull request merged into it.
   */
  public static isPullTarget(status: GitStatus, url: string, branch: string): boolean {
    const remote: GitRemote | null = status.remote;
    return remote !== null && status.branch === branch && status.upstream?.name === Resources.formatRemoteBranch(remote.name, branch)
      && PullRequestClone.isCloneOf(remote, url);
  }

  private static isSame(left: string | null | undefined, right: string): boolean {
    return left !== null && left !== undefined && left.toLowerCase() === right.toLowerCase();
  }

  private static patternOf(host: string | null): RegExp {
    if (host === Resources.azureHost)
      return Resources.remoteWebRepositoryPattern;
    return host === Resources.azureSshHost || host === Resources.visualStudioSshHost ? Resources.remoteSshRepositoryPattern
      : Resources.remoteCollectionRepositoryPattern;
  }
}
