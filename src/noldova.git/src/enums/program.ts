/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const Program = {
  Git: "Git",
  Gh: "Gh"
} as const;

export type Program = (typeof Program)[keyof typeof Program];
