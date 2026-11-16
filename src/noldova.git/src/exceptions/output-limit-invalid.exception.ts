/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { GitException } from "./git.exception.ts";

export class OutputLimitInvalidException extends GitException {
  public readonly outputBytes: number;

  public constructor(outputBytes: number) {
    super(Resources.outputLimitInvalid);

    this.outputBytes = outputBytes;
  }
}
