/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostingProtocolException, HostReference } from "@noldova/git.hosting.protocol";

import { Resources } from "../../resources.ts";

export class PullRequestDocument {
  public static instanceOf(reference: HostReference): string {
    return Resources.formatPullRequestInstance(reference.owner, reference.repository, reference.number);
  }

  public static referenceOf(instance: string): HostReference | null {
    const parts = Resources.pullRequestInstancePattern.exec(instance)?.groups;
    const owner: string | undefined = parts?.[Resources.ownerGroup];
    const repository: string | undefined = parts?.[Resources.repositoryGroup];
    const number: string | undefined = parts?.[Resources.numberGroup];
    if (Object.isUndefined(owner) || Object.isUndefined(repository) || Object.isUndefined(number))
      return null;
    try {
      return new HostReference(AzureDevOpsNames.moduleId, owner, repository, Number(number));
    }
    catch (error) {
      if (error instanceof HostingProtocolException)
        return null;
      throw error;
    }
  }
}
