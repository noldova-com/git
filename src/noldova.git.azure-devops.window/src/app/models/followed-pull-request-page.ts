/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

export class FollowedPullRequestPage {
  public readonly instance: Signal<string>;
  public readonly active: Signal<boolean>;

  public constructor(instance: Signal<string>, active: Signal<boolean>) {
    this.instance = instance;
    this.active = active;
  }
}
