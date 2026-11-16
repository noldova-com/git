/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { JsonValueException } from "./json-value.exception.ts";

export class JsonValueNotTextException extends JsonValueException {
  public readonly field: string;

  public constructor(field: string) {
    super(Resources.formatJsonValueNotText(field));

    this.field = field;
  }
}
