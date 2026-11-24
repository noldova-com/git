/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRemote } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";

export class AzureDevOpsRemote {
  public static isAzureDevOps(remote: GitRemote): boolean {
    const host: string | null = remote.host;
    return host === Resources.azureHost || host === Resources.azureSshHost || host === Resources.visualStudioSshHost
      || (host !== null && host.endsWith(Resources.visualStudioSuffix));
  }
}
