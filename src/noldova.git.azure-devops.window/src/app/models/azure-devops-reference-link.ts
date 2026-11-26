/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostReference, WorkItemQuery } from "@noldova/git.hosting.protocol";

export class AzureDevOpsReferenceLink {
  public readonly query: WorkItemQuery | HostReference;
  public readonly key: string;
  public readonly project: string | null;

  public constructor(query: WorkItemQuery | HostReference, key: string, project: string | null = null) {
    this.query = query;
    this.key = key;
    this.project = project;
  }
}
