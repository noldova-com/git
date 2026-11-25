/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** Where a repository lives: its host and its path there, either null when a remote's address doesn't name it. */
export interface IRemotePlace {
  readonly host: string | null;
  readonly path: string | null;
}
