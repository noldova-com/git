/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ProcessException } from "./process.exception.ts";

export class NpmListFailedException extends ProcessException {
  public readonly listArguments: readonly string[];
  public readonly code: string;
  public readonly summary: string;

  public constructor(listArguments: readonly string[], place: string, code: string, summary: string) {
    super(Resources.formatNpmListFailed(listArguments, place, code, summary));

    this.listArguments = listArguments;
    this.code = code;
    this.summary = summary;
  }
}
