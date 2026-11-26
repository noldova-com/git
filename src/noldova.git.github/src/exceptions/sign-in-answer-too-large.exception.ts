/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { SignInRefusedException } from "./sign-in-refused.exception.ts";

export class SignInAnswerTooLargeException extends SignInRefusedException {
  public readonly url: string;

  public constructor(url: string) {
    super(Resources.formatSignInAnswerTooLarge(url));

    this.url = url;
  }
}
