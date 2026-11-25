/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A watch's connection and window, which a client's leaving matches. */
export interface IWatchOwner {
  readonly connection: number;
  readonly window: number | null;
}
