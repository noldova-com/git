/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ProcessException } from "./process.exception.ts";

export class ProcessStartFailedException extends ProcessException {
  public readonly command: string;

  public constructor(command: string, cause: unknown) {
    super(Resources.formatProcessStartFailed(command), { cause });

    this.command = command;
  }
}
