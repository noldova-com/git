/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class ImportUnpinnedException extends PackageException {
  public readonly packageName: string;
  public readonly file: string;

  public constructor(name: string, file: string) {
    super(Resources.formatImportUnpinned(name, file));

    this.packageName = name;
    this.file = file;
  }
}
