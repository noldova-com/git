/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { GitRemote, GitStatus } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { WorkItemsPlace } from "./work-items-place.ts";

export class PullRequestClone {
  public static isCloneOf(remote: GitRemote | null, url: string): boolean {
    const page = Resources.pullRequestAddressPattern.exec(url);
    const place: WorkItemsPlace | null = WorkItemsPlace.ofRemote(remote);
    const repository: string | null = PullRequestClone.repositoryOf(remote);
    if (Object.isNull(page) || Object.isNull(place) || Object.isNull(repository))
      return false;
    return PullRequestClone.isSame(page[1], place.organization) && PullRequestClone.isSame(WorkItemsPlace.decode(page[2]), place.project)
      && PullRequestClone.isSame(WorkItemsPlace.decode(page[3]), repository);
  }

  public static repositoryOf(remote: GitRemote | null): string | null {
    return WorkItemsPlace.decode(PullRequestClone.patternOf(remote?.host ?? null).exec(remote?.path ?? "")?.[1]);
  }

  public static isPullTarget(status: GitStatus, url: string, branch: string): boolean {
    const remote: GitRemote | null = status.remote;
    return !Object.isNull(remote) && status.branch === branch && status.upstream?.name === Resources.formatRemoteBranch(remote.name, branch)
      && PullRequestClone.isCloneOf(remote, url);
  }

  private static isSame(left: string | null | undefined, right: string): boolean {
    return !Object.isNullOrUndefined(left) && left.toLowerCase() === right.toLowerCase();
  }

  private static patternOf(host: string | null): RegExp {
    if (host === Resources.azureHost)
      return Resources.remoteWebRepositoryPattern;
    return host === Resources.azureSshHost || host === Resources.visualStudioSshHost ? Resources.remoteSshRepositoryPattern
      : Resources.remoteCollectionRepositoryPattern;
  }
}
