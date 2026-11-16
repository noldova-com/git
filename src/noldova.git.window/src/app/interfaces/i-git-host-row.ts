/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Type } from "@angular/core";
import type { GitRemote } from "@noldova/git.protocol";

export interface IGitHostRow {
  claims(remote: GitRemote): boolean;
  readonly component: Type<unknown>;
}
