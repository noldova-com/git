/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ProcessException } from "./process.exception.ts";

export class NpmListUnreadableException extends ProcessException {
  public readonly listArguments: readonly string[];
  public readonly output: string;

  public constructor(listArguments: readonly string[], place: string, output: string, cause: unknown) {
    super(Resources.formatNpmListUnreadable(listArguments, place, output), { cause });

    this.listArguments = listArguments;
    this.output = output;
  }
}
