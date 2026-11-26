/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

export class GitFolderPage {
  public readonly folder: Signal<string>;
  public readonly active: Signal<boolean>;

  public constructor(folder: Signal<string>, active: Signal<boolean>) {
    this.folder = folder;
    this.active = active;
  }
}
