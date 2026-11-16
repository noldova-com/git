/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { SignInRefusedException } from "./sign-in-refused.exception.ts";

export class SignInExpiryInvalidException extends SignInRefusedException {
  public readonly seconds: number;

  public constructor(seconds: number) {
    super(Resources.formatSignInExpiryInvalid(seconds));

    this.seconds = seconds;
  }
}
