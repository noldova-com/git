/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart } from "@noldova/desktop.runtime";
import { GitHubNames } from "@noldova/git.github.protocol";
import { RuntimePart as GitHubRuntimePart } from "@noldova/git.github/runtime";
import { HostReference } from "@noldova/git.hosting.protocol";
import { GitNames } from "@noldova/git.protocol";
import { RuntimePart as GitRuntimePart } from "@noldova/git/runtime";

import { InstalledPackageCheckFailedException } from "../../exceptions/installed-package-check-failed.exception.ts";
import { InstalledPackageResources } from "./installed-package-resources.ts";

export class RuntimePartReading {
  public static readonly parts: readonly IRuntimePart[] = [new GitRuntimePart(), new GitHubRuntimePart()];

  public static run(): void {
    const reference: HostReference = HostReference.fromJson({ host: GitHubNames.moduleId, owner: InstalledPackageResources.sampleOwner,
      repository: InstalledPackageResources.sampleRepository, number: InstalledPackageResources.sampleNumber });
    const read: string = [GitNames.moduleId, GitHubNames.moduleId, reference.text].join(InstalledPackageResources.readingSeparator);
    if (read !== InstalledPackageResources.expectedReading)
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.formatProtocolsMisread(read));
  }
}

try {
  RuntimePartReading.run();
}
catch (error) {
  if (!(error instanceof InstalledPackageCheckFailedException))
    throw error;
  console.error(error.message);
  process.exitCode = InstalledPackageResources.failureExitCode;
}
