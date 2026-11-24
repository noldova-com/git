/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The local folder, and its branch, that the person asked to pull once the pull request merges. */
export type PullAfter = { readonly folder: string; readonly branch: string };
