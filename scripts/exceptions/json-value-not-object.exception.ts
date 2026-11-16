/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { JsonValueException } from "./json-value.exception.ts";

export class JsonValueNotObjectException extends JsonValueException {
  public readonly context: string;

  public constructor(context: string) {
    super(Resources.formatJsonValueNotObject(context));

    this.context = context;
  }
}
