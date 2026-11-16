/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const WatchStart = {
  Seen: "Seen",
  Backstop: "Backstop",
  Stopped: "Stopped"
} as const;

export type WatchStart = (typeof WatchStart)[keyof typeof WatchStart];
