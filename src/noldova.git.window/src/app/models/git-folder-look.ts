/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import type { GitRepositoryScan } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";

export class GitFolderLook {
  public readonly folder: string;
  public readonly text: WritableSignal<string>;
  public readonly offers: Set<(scan: GitRepositoryScan) => void> = new Set();

  public constructor(folder: string) {
    this.folder = folder;
    this.text = signal(Resources.formatLookingBelow(folder));
  }
}
