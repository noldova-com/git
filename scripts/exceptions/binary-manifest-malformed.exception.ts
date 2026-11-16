/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class BinaryManifestMalformedException extends PackageException {
  public readonly manifest: string;

  public constructor(manifest: string, cause: unknown) {
    super(Resources.formatBinaryManifestMalformed(manifest), { cause });

    this.manifest = manifest;
  }
}
