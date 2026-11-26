/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal, Type } from "@angular/core";

import type { GitHostFeature } from "../enums/git-host-feature.ts";
import type { GitHostCard } from "../models/git-host-card.ts";

export interface IGitHostAccount {
  readonly id: string;
  readonly host: string;
  readonly column: string;
  readonly mark: string;
  readonly markColor: string;
  readonly cards: Signal<readonly GitHostCard[]>;
  readonly signIn: Type<unknown>;
  readonly features: readonly GitHostFeature[];
}
