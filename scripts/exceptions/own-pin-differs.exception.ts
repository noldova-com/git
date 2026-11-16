/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class OwnPinDiffersException extends PackageException {
  public readonly file: string;
  public readonly packageName: string;
  public readonly pin: string;
  public readonly version: string;

  public constructor(file: string, name: string, pin: string, version: string) {
    super(Resources.formatOwnPinDiffers(file, name, pin, version));

    this.file = file;
    this.packageName = name;
    this.pin = pin;
    this.version = version;
  }
}
