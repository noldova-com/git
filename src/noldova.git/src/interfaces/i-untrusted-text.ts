/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UntrustedSource } from "@noldova/git.protocol";

export interface IUntrustedText {
  readonly text: string;
  readonly source: UntrustedSource;
}
