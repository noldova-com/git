/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFolderParams } from "./i-folder-params.ts";

export interface IWriteParams extends IFolderParams {
  readonly basedOn: string;
}
