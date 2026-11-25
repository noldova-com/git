/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

/** A document a detail view follows: its choice, and whether it is the window's active document. */
export class GitDetailPage<T> {
  public readonly choice: Signal<T | null>;
  public readonly active: Signal<boolean>;

  public constructor(choice: Signal<T | null>, active: Signal<boolean>) {
    this.choice = choice;
    this.active = active;
  }
}
