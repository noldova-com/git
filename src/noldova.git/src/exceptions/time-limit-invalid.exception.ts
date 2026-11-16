/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { GitException } from "./git.exception.ts";

export class TimeLimitInvalidException extends GitException {
  public readonly milliseconds: number;

  public constructor(milliseconds: number) {
    super(Resources.timeLimitInvalid);

    this.milliseconds = milliseconds;
  }
}
