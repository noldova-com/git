/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const TreeWatch = {
  Whole: "Whole",
  Folders: "Folders",
  None: "None"
} as const;

export type TreeWatch = (typeof TreeWatch)[keyof typeof TreeWatch];
