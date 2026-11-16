/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { GitException } from "./git.exception.ts";

export class FolderNotAbsoluteException extends GitException {
  public readonly label: string;
  public readonly folder: string;

  public constructor(label: string, folder: string) {
    super(Resources.formatFolderNotAbsolute(label));

    this.label = label;
    this.folder = folder;
  }
}
