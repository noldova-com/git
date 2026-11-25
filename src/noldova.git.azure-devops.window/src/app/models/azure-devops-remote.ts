/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { GitRemote } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { WorkItemsPlace } from "./work-items-place.ts";

export class AzureDevOpsRemote {
  public static isAzureDevOps(remote: GitRemote): boolean {
    const host: string | null = remote.host;
    return host === Resources.azureHost || host === Resources.azureSshHost || host === Resources.visualStudioSshHost
      || (!Object.isNull(host) && host.endsWith(Resources.visualStudioSuffix));
  }

  /**
   * The remote's path as a query to the host carries it, each name percent-encoded but for letters, digits, `.`, `_` and `-`, since a project's or
   * repository's name may hold a space or another character; a name git kept encoded, as an SSH remote keeps `%20`, is decoded first. Null without a path.
   */
  public static pathOf(remote: GitRemote): string | null {
    const path: string | null = remote.path;
    return Object.isNull(path) ? null : path.split(Resources.remotePathSeparator).map(t => encodeURIComponent(WorkItemsPlace.decode(t) ?? t)
      .replace(Resources.unescapedPattern, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)).join(Resources.remotePathSeparator);
  }
}
