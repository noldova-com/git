/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";

export class GitViewOptions {
  public static readonly showsBranch: WritableSignal<boolean> = signal(true);
  public static readonly showsAiFeatures: WritableSignal<boolean> = signal(false);
}
