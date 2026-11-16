/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class BinaryMissingException extends PackageException {
  public readonly folder: string;
  public readonly packageName: string;

  public constructor(folder: string, packageName: string) {
    super(Resources.formatBinaryMissing(folder, packageName));

    this.folder = folder;
    this.packageName = packageName;
  }
}
