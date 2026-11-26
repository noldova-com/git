/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type Signal } from "@angular/core";

export class GitRepositoryLink {
  public readonly key: string;
  public readonly label: string;
  public readonly icon: string;
  public readonly open: () => void;
  public readonly isActive: Signal<boolean>;

  public constructor(key: string, label: string, icon: string, open: () => void, isActive: Signal<boolean> = GitRepositoryLink.never) {
    this.key = key;
    this.label = label;
    this.icon = icon;
    this.open = open;
    this.isActive = isActive;
  }

  private static readonly never: Signal<boolean> = computed(() => false);
}
