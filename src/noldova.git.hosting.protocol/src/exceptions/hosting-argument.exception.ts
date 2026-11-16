/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { HostingProtocolException } from "./hosting-protocol.exception.ts";

export class HostingArgumentException extends HostingProtocolException {
  public readonly parameterName: string;
  public readonly expectation: string;

  public constructor(parameterName: string, expectation: string) {
    super(Resources.formatInvalidArgument(parameterName, expectation));

    this.parameterName = parameterName;
    this.expectation = expectation;
  }
}
