/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class CompileFailedException extends PackageException {
  public readonly folder: string;
  public readonly exitCode: number;

  public constructor(folder: string, exitCode: number) {
    super(Resources.formatCompileFailed(folder, exitCode));

    this.folder = folder;
    this.exitCode = exitCode;
  }
}
