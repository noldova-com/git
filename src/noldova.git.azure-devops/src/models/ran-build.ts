/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostBuild } from "@noldova/git.hosting.protocol";

export class RanBuild {
  public readonly build: HostBuild;
  public readonly id: number | null;

  public constructor(build: HostBuild, id: number | null) {
    this.build = build;
    this.id = id;
  }
}
