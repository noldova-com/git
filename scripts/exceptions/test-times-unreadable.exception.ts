/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ScriptException } from "./script.exception.ts";

export class TestTimesUnreadableException extends ScriptException {
  public readonly file: string;

  public constructor(file: string, cause?: unknown) {
    super(Resources.formatTestTimesUnreadable(file), { cause });

    this.file = file;
  }
}
