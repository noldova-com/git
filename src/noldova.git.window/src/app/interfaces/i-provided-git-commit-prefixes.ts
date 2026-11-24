/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";

import type { IGitCommitPrefixes } from "./i-git-commit-prefixes.ts";

export interface IProvidedGitCommitPrefixes {
  readonly context: IWindowPartContext;
  readonly prefixes: IGitCommitPrefixes;
}
