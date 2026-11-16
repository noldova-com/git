/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";

import type { IGitHostRow } from "./i-git-host-row.ts";

export interface IProvidedGitHostRow {
  readonly context: IWindowPartContext;
  readonly row: IGitHostRow;
}
