/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { HostingProtocolException } from "./hosting-protocol.exception.ts";

export class HostingFieldException extends HostingProtocolException {
  public readonly field: string;
  public readonly expectation: string;

  public constructor(field: string, expectation: string) {
    super(Resources.formatInvalidField(field, expectation));

    this.field = field;
    this.expectation = expectation;
  }
}
