/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { SignInRefusedException } from "./sign-in-refused.exception.ts";

export class SignInRequestRefusedException extends SignInRefusedException {
  public readonly url: string;
  public readonly status: number;

  public constructor(url: string, status: number) {
    super(Resources.formatSignInRequestRefused(url, status));

    this.url = url;
    this.status = status;
  }
}
