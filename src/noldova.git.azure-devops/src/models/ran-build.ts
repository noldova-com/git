/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostBuild } from "@noldova/git.hosting.protocol";

/** A build a pull request ran, and its id, which a build policy's evaluation names; null when Azure DevOps gives none. */
export class RanBuild {
  public readonly build: HostBuild;
  public readonly id: number | null;

  public constructor(build: HostBuild, id: number | null) {
    this.build = build;
    this.id = id;
  }
}
