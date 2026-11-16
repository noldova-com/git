/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ProtocolException } from "./protocol.exception.ts";

export class ProtocolFieldException extends ProtocolException {
  public readonly field: string;
  public readonly expectation: string;

  public constructor(field: string, expectation: string) {
    super(Resources.formatInvalidField(field, expectation));

    this.field = field;
    this.expectation = expectation;
  }
}
