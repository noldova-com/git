/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class ArchiveInstallFailedException extends PackageException {
  public readonly archives: readonly string[];
  public readonly exitCode: number | null;
  public readonly output: string;

  public constructor(archives: readonly string[], exitCode: number | null, output: string) {
    super(Resources.formatArchiveInstallFailed(archives, exitCode, output));

    this.archives = archives;
    this.exitCode = exitCode;
    this.output = output;
  }
}
