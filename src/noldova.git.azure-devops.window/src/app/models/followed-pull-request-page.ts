/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

/** A pull request's page that's open: its document's instance, which is the pull request's key, and whether it's the window's active document. */
export class FollowedPullRequestPage {
  public readonly instance: Signal<string>;
  public readonly active: Signal<boolean>;

  public constructor(instance: Signal<string>, active: Signal<boolean>) {
    this.instance = instance;
    this.active = active;
  }
}
