/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { OutputLimitInvalidException } from "../exceptions/output-limit-invalid.exception.ts";
import { TimeLimitInvalidException } from "../exceptions/time-limit-invalid.exception.ts";

export class ProgramLimits {
  public readonly outputBytes: number;
  public readonly milliseconds: number;

  public constructor(outputBytes: number, milliseconds: number) {
    if (!Number.isSafeInteger(outputBytes) || outputBytes < 1)
      throw new OutputLimitInvalidException(outputBytes);
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 1)
      throw new TimeLimitInvalidException(milliseconds);

    this.outputBytes = outputBytes;
    this.milliseconds = milliseconds;
  }
}
