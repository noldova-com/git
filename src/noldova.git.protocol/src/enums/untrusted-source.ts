/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const UntrustedSource = {
  Repository: "Repository",
  GitHub: "GitHub"
} as const;

export type UntrustedSource = (typeof UntrustedSource)[keyof typeof UntrustedSource];
