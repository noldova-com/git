/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class ArchiveManifestNotObjectException extends PackageException {
  public readonly context: string;

  public constructor(context: string, cause: unknown) {
    super(Resources.formatArchiveManifestNotObject(context), { cause });

    this.context = context;
  }
}
