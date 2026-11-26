/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal, WritableSignal } from "@angular/core";

export interface IGitHubHome {
  readonly read: WritableSignal<string | null | undefined>;
  readonly shown: Signal<string | null>;
}
